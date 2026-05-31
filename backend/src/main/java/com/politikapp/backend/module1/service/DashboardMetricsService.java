package com.politikapp.backend.module1.service;

import com.politikapp.backend.module1.dto.SymmetricalKpiPayload;
import com.politikapp.backend.module1.entity.Politician;
import com.politikapp.backend.module1.entity.ProfileEditSubmission;
import com.politikapp.backend.module1.repository.ProfileEditSubmissionRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class DashboardMetricsService {
    private static final double BILLS_REFERENCE_CEILING = 50.0;
    private static final double PROJECTS_REFERENCE_CEILING = 30.0;
    private static final double BUDGET_REFERENCE_CEILING_PHP = 500_000_000.0;
    private static final double COA_PENALTY_PER_FINDING = 5.0;
    private static final double COA_MAX_PENALTY = 40.0;

    private final ProfileEditSubmissionRepository submissionRepository;

    public DashboardMetricsService(ProfileEditSubmissionRepository submissionRepository) {
        this.submissionRepository = submissionRepository;
    }

    public SymmetricalKpiPayload buildKpiPayload(Politician politician) {
        List<ProfileEditSubmission> submissions = submissionRepository
                .findByPoliticianIdAndStatus(politician.getPoliticianId(), "PUBLISHED");

        double billsAuthored = sumEffectiveLegislation(submissions);
        double projectCompletions = sumEffectiveProjects(submissions);
        int coaDiscrepancies = Math.toIntExact(countByAction(submissions, "COA_FINDING"));
        BigDecimal totalBudget = submissions.stream()
                .filter(submission -> "BUDGET_ALLOCATION".equals(submission.getActionIdentifier()))
                .map(this::allocationAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalFlagged = sumFlaggedAmount(submissions);

        double efficiencyRatio = 0.0;
        try {
            if (billsAuthored > 0) {
                efficiencyRatio = (projectCompletions / billsAuthored) * 100.0;
            }
        } catch (ArithmeticException | NullPointerException e) {
            efficiencyRatio = 0.0;
        }

        double wgiScore = computeWgiCompositeScore(
                politician.getPosition(),
                billsAuthored,
                projectCompletions,
                totalBudget,
                totalFlagged,
                coaDiscrepancies);

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
                wgiScore);
    }

    /**
     * Computes a position-aware WGI Composite Score in the range [0, 100].
     *
     * Each indicator is first normalized to [0, 100] relative to its reference
     * ceiling, then multiplied by its position-group weight, and finally
     * penalized by COA audit discrepancies (Control of Corruption pillar).
     *
     * @param position           Politician position string (e.g. "SENATOR",
     *                           "MAYOR")
     * @param billsAuthored      Count of SPONSORED_LEGISLATION submissions
     * @param projectCompletions Count of PROJECT_COMPLETION submissions
     * @param trackedBudget      Sum of BUDGET_ALLOCATION submission amounts (PHP)
     * @param totalFlagged       Sum of COA_FINDING flagged amounts (PHP)
     * @param coaDiscrepancies   Count of COA_FINDING submissions
     * @return WGI composite score clamped to [0, 100]
     */
    public double computeWgiCompositeScore(
            String position,
            double billsAuthored,
            double projectCompletions,
            BigDecimal trackedBudget,
            BigDecimal totalFlagged,
            int coaDiscrepancies) {
        // Normalize each raw indicator to [0, 100]
        double normBills = normalize(billsAuthored, BILLS_REFERENCE_CEILING);
        double normProjects = normalize(projectCompletions, PROJECTS_REFERENCE_CEILING);
        double normBudget = normalize(
                trackedBudget != null ? trackedBudget.doubleValue() : 0.0,
                BUDGET_REFERENCE_CEILING_PHP);

        // Compute efficiency signal: min(100, bills+projects normalized blend)
        double legEfficiency = Math.min(100.0,
                billsAuthored > 0
                        ? (normProjects * 0.5 + normBills * 0.5)
                        : normProjects);

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

            case "VICE_EXECUTIVE":
                // billsAuthored(0.30) + projectCompletions(0.20) + budget(0.25) + hybridEfficiency(0.25)
                rawScore = (normBills * 0.30)
                        + (normProjects * 0.20)
                        + (normBudget * 0.25)
                        + (legEfficiency * 0.25);
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

        // Apply COA penalty: frequency penalty + financial magnitude penalty, capped at 40 (Control of Corruption pillar)
        double freqPenalty = coaDiscrepancies * 2.0;
        double magPenalty = 0.0;
        double budget = trackedBudget != null ? trackedBudget.doubleValue() : 0.0;
        double flagged = totalFlagged != null ? totalFlagged.doubleValue() : 0.0;

        if (flagged > 0) {
            if (budget > 0) {
                magPenalty = Math.min(30.0, (flagged / (budget + 1000.0)) * 40.0);
            } else {
                magPenalty = Math.min(30.0, coaDiscrepancies * 3.0);
            }
        }

        double coaPenalty = Math.min(40.0, freqPenalty + magPenalty);
        double finalScore = rawScore - coaPenalty;

        // Clamp to [0, 100]
        return Math.max(0.0, Math.min(100.0, finalScore));
    }

    // ─── Private Helpers ───────────────────────────────────────────────────────

    private double sumEffectiveProjects(List<ProfileEditSubmission> submissions) {
        return submissions.stream()
                .filter(sub -> "PROJECT_COMPLETION".equals(sub.getActionIdentifier()))
                .mapToDouble(sub -> {
                    Map<String, Object> details = sub.getActionDetails();
                    if (details == null || !details.containsKey("completionPercentage")) {
                        return 1.0;
                    }
                    Object val = details.get("completionPercentage");
                    if (val == null) {
                        return 1.0;
                    }
                    try {
                        return Double.parseDouble(val.toString()) / 100.0;
                    } catch (NumberFormatException | NullPointerException e) {
                        return 1.0;
                    }
                })
                .sum();
    }

    private double sumEffectiveLegislation(List<ProfileEditSubmission> submissions) {
        return submissions.stream()
                .filter(sub -> "SPONSORED_LEGISLATION".equals(sub.getActionIdentifier()))
                .mapToDouble(sub -> {
                    Map<String, Object> details = sub.getActionDetails();
                    if (details == null || !details.containsKey("legislativeStatus")) {
                        return 1.0;
                    }
                    Object val = details.get("legislativeStatus");
                    if (val == null) {
                        return 1.0;
                    }
                    String status = val.toString().trim().toUpperCase();
                    return switch (status) {
                        case "APPROVED", "ENACTED" -> 1.0;
                        case "IN COMMITTEE", "IN_COMMITTEE" -> 0.6;
                        case "FILED" -> 0.3;
                        case "REJECTED", "WITHDRAWN" -> 0.0;
                        default -> 1.0;
                    };
                })
                .sum();
    }

    private BigDecimal sumFlaggedAmount(List<ProfileEditSubmission> submissions) {
        return submissions.stream()
                .filter(sub -> "COA_FINDING".equals(sub.getActionIdentifier()))
                .map(sub -> {
                    Map<String, Object> details = sub.getActionDetails();
                    if (details == null || !details.containsKey("flaggedAmount")) {
                        return BigDecimal.ZERO;
                    }
                    Object val = details.get("flaggedAmount");
                    if (val == null) {
                        return BigDecimal.ZERO;
                    }
                    try {
                        return new BigDecimal(val.toString());
                    } catch (NumberFormatException | NullPointerException e) {
                        return BigDecimal.ZERO;
                    }
                })
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /**
     * Normalizes a raw value against a reference ceiling to produce a [0, 100]
     * score.
     */
    private double normalize(double rawValue, double ceiling) {
        if (ceiling <= 0)
            return 0.0;
        return Math.min(100.0, (rawValue / ceiling) * 100.0);
    }

    /** Maps a position string to a logical group for WGI weight selection. */
    private String resolvePositionGroup(String position) {
        if (position == null)
            return "DEFAULT";
        return switch (position.toUpperCase()) {
            case "PRESIDENT", "MAYOR" -> "EXECUTIVE";
            case "VICE_PRESIDENT", "VICE_MAYOR" -> "VICE_EXECUTIVE";
            case "SENATOR", "HOUSE_REPRESENTATIVE" -> "LEGISLATIVE";
            case "CITY_COUNCILOR" -> "COUNCIL";
            default -> "DEFAULT";
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
