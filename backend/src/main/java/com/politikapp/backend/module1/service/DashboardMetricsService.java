package com.politikapp.backend.module1.service;

import com.politikapp.backend.module1.dto.SymmetricalKpiPayload;
import com.politikapp.backend.module1.entity.Politician;
import com.politikapp.backend.module1.entity.ProfileEditSubmission;
import com.politikapp.backend.module1.repository.ProfileEditSubmissionRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/**
 * DashboardMetricsService
 * ───────────────────────────────────────────────────────────────────────────
 * Computes all KPI metrics for a given politician profile, including the
 * Position-Aware WGI Composite Score following the World Bank Worldwide
 * Governance Indicators (WGI) aggregation methodology.
 *
 * WGI Methodology Reference (Kaufmann, Kraay & Mastruzzi):
 *   1. Multiple observed indicators mapped to governance dimensions.
 *   2. Weighted linear aggregation of normalized indicator values.
 *   3. Penalization for negative governance signals (COA audit discrepancies).
 *
 * Position Group Weights:
 *   LEGISLATIVE (Senator, House Representative):
 *     - billsAuthored       → 0.35  (Voice and Accountability)
 *     - trackedBudget       → 0.25  (Government Effectiveness)
 *     - legislativeEfficiency → 0.30 (Rule of Law)
 *     - Penalty: -5 per COA finding (max deduction: 40)
 *
 *   EXECUTIVE (Mayor, Vice Mayor):
 *     - projectCompletions  → 0.45  (Government Effectiveness)
 *     - trackedBudget       → 0.30  (Government Effectiveness)
 *     - deliveryEfficiency  → 0.20  (Political Stability)
 *     - Penalty: -5 per COA finding (max deduction: 40)
 *
 *   COUNCIL (City Councilor):
 *     - ordinancesFiled     → 0.40  (Voice and Accountability)
 *     - trackedBudget       → 0.35  (Regulatory Quality)
 *     - Penalty: -5 per COA finding (max deduction: 40)
 */
@Service
public class DashboardMetricsService {

    // ─── WGI Normalization Constants ───────────────────────────────────────────
    /** Bills/ordinances: normalize against a 50-bill reference ceiling → score out of 100. */
    private static final double BILLS_REFERENCE_CEILING = 50.0;
    /** Projects: normalize against a 30-project reference ceiling → score out of 100. */
    private static final double PROJECTS_REFERENCE_CEILING = 30.0;
    /** Budget: normalize against a 500M PHP reference ceiling → score out of 100. */
    private static final double BUDGET_REFERENCE_CEILING_PHP = 500_000_000.0;
    /** Penalty per COA audit discrepancy (WGI Control of Corruption deduction). */
    private static final double COA_PENALTY_PER_FINDING = 5.0;
    /** Maximum total COA penalty cap to prevent total score collapse. */
    private static final double COA_MAX_PENALTY = 40.0;

    private final ProfileEditSubmissionRepository submissionRepository;

    public DashboardMetricsService(ProfileEditSubmissionRepository submissionRepository) {
        this.submissionRepository = submissionRepository;
    }

    public SymmetricalKpiPayload buildKpiPayload(Politician politician) {
        List<ProfileEditSubmission> submissions = submissionRepository
                .findByPoliticianIdAndStatus(politician.getPoliticianId(), "PUBLISHED");

        long billsAuthored = countByAction(submissions, "SPONSORED_LEGISLATION");
        long projectCompletions = countByAction(submissions, "PROJECT_COMPLETION");
        int coaDiscrepancies = Math.toIntExact(countByAction(submissions, "COA_FINDING"));
        BigDecimal totalBudget = submissions.stream()
                .filter(submission -> "BUDGET_ALLOCATION".equals(submission.getActionIdentifier()))
                .map(this::allocationAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Legacy ratio (kept for backward compatibility with existing API consumers)
        double efficiencyRatio = 0.0;
        try {
            if (billsAuthored > 0) {
                efficiencyRatio = ((double) projectCompletions / billsAuthored) * 100.0;
            }
        } catch (ArithmeticException | NullPointerException e) {
            efficiencyRatio = 0.0;
        }

        double wgiScore = computeWgiCompositeScore(
                politician.getPosition(),
                billsAuthored,
                projectCompletions,
                totalBudget,
                coaDiscrepancies
        );

        return new SymmetricalKpiPayload(
                politician.getPoliticianId(),
                politician.getFullName(),
                politician.getPosition(),
                politician.getJurisdiction(),
                politician.getPartyAffiliation(),
                billsAuthored,
                projectCompletions,
                coaDiscrepancies,
                totalBudget,
                efficiencyRatio,
                wgiScore
        );
    }

    /**
     * Computes a position-aware WGI Composite Score in the range [0, 100].
     *
     * Each indicator is first normalized to [0, 100] relative to its reference
     * ceiling, then multiplied by its position-group weight, and finally
     * penalized by COA audit discrepancies (Control of Corruption pillar).
     *
     * @param position          Politician position string (e.g. "SENATOR", "MAYOR")
     * @param billsAuthored     Count of SPONSORED_LEGISLATION submissions
     * @param projectCompletions Count of PROJECT_COMPLETION submissions
     * @param trackedBudget     Sum of BUDGET_ALLOCATION submission amounts (PHP)
     * @param coaDiscrepancies  Count of COA_FINDING submissions
     * @return WGI composite score clamped to [0, 100]
     */
    public double computeWgiCompositeScore(
            String position,
            long billsAuthored,
            long projectCompletions,
            BigDecimal trackedBudget,
            int coaDiscrepancies
    ) {
        // Normalize each raw indicator to [0, 100]
        double normBills    = normalize(billsAuthored, BILLS_REFERENCE_CEILING);
        double normProjects = normalize(projectCompletions, PROJECTS_REFERENCE_CEILING);
        double normBudget   = normalize(
                trackedBudget != null ? trackedBudget.doubleValue() : 0.0,
                BUDGET_REFERENCE_CEILING_PHP
        );

        // Compute efficiency signal: min(100, bills+projects normalized blend)
        double legEfficiency = Math.min(100.0,
                billsAuthored > 0
                        ? (normProjects * 0.5 + normBills * 0.5)
                        : normProjects
        );

        double rawScore;
        String positionGroup = resolvePositionGroup(position);

        switch (positionGroup) {
            case "LEGISLATIVE":
                // billsAuthored(0.35) + budget(0.25) + legislativeEfficiency(0.30)
                rawScore = (normBills * 0.35)
                        + (normBudget * 0.25)
                        + (legEfficiency * 0.30);
                break;

            case "EXECUTIVE":
                // projectCompletions(0.45) + budget(0.30) + deliveryEfficiency(0.20)
                rawScore = (normProjects * 0.45)
                        + (normBudget * 0.30)
                        + (legEfficiency * 0.20);
                break;

            case "COUNCIL":
                // ordinancesFiled(0.40) + budget(0.35)
                rawScore = (normBills * 0.40)
                        + (normBudget * 0.35);
                break;

            default:
                // Balanced fallback for unknown positions
                rawScore = (normBills * 0.25)
                        + (normProjects * 0.25)
                        + (normBudget * 0.20)
                        + (legEfficiency * 0.20);
                break;
        }

        // Apply COA penalty: -5 per finding, capped at 40 (Control of Corruption pillar)
        double coaPenalty = Math.min(coaDiscrepancies * COA_PENALTY_PER_FINDING, COA_MAX_PENALTY);
        double finalScore = rawScore - coaPenalty;

        // Clamp to [0, 100]
        return Math.max(0.0, Math.min(100.0, finalScore));
    }

    // ─── Private Helpers ───────────────────────────────────────────────────────

    /** Normalizes a raw value against a reference ceiling to produce a [0, 100] score. */
    private double normalize(double rawValue, double ceiling) {
        if (ceiling <= 0) return 0.0;
        return Math.min(100.0, (rawValue / ceiling) * 100.0);
    }

    /** Maps a position string to a logical group for WGI weight selection. */
    private String resolvePositionGroup(String position) {
        if (position == null) return "DEFAULT";
        return switch (position.toUpperCase()) {
            case "SENATOR", "HOUSE_REPRESENTATIVE" -> "LEGISLATIVE";
            case "MAYOR", "VICE_MAYOR"             -> "EXECUTIVE";
            case "CITY_COUNCILOR"                   -> "COUNCIL";
            default                                 -> "DEFAULT";
        };
    }

    private long countByAction(List<ProfileEditSubmission> submissions, String actionIdentifier) {
        return submissions.stream()
                .filter(submission -> actionIdentifier.equals(submission.getActionIdentifier()))
                .count();
    }

    private BigDecimal allocationAmount(ProfileEditSubmission submission) {
        Map<String, Object> details = submission.getActionDetails();
        if (details == null || !details.containsKey("allocationAmount")) {
            return BigDecimal.ZERO;
        }
        Object value = details.get("allocationAmount");
        if (value == null) {
            return BigDecimal.ZERO;
        }
        try {
            return new BigDecimal(value.toString());
        } catch (NumberFormatException exception) {
            return BigDecimal.ZERO;
        }
    }
}
