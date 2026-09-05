package com.politikapp.backend.module1;

import static org.assertj.core.api.Assertions.assertThat;

import com.politikapp.backend.module1.service.DashboardMetricsService;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class DashboardMetricsServiceTests {
    private final DashboardMetricsService dashboardMetricsService = new DashboardMetricsService(null);

    @Test
    void verifiesWgiScoreCalculationForExecutive() {
        // PRESIDENT is mapped to EXECUTIVE.
        // normProjects = projects(3.0) / 30 * 100 = 10%
        // normBudget = budget(100M) / 500M * 100 = 20%
        // legEfficiency = projects(3.0) / bills(0) -> 10% (under EXECUTIVE billsAuthored = 0 falls back to normProjects)
        // rawScore = 10 * 0.45 + 20 * 0.30 + 10 * 0.20 = 4.5 + 6.0 + 2.0 = 12.5%
        // coa Penalty: freqPenalty = 1 discrepancy * 2 = 2.0
        //             magPenalty = Math.min(30, (flagged(0) / 100M)*40) = 0.0
        //             totalPenalty = freqPenalty + magPenalty = 2.0
        // finalScore = 12.5 - 2 = 10.5%
        double score = dashboardMetricsService.computeWgiCompositeScore(
                "PRESIDENT",
                0.0, // billsAuthored
                3.0, // projectCompletions
                new BigDecimal("100000000"), // trackedBudget
                BigDecimal.ZERO, // totalFlagged
                1 // coaDiscrepancies
        );
        assertThat(score).isEqualTo(10.5);
    }

    @Test
    void verifiesProportionalCoaAuditPenalties() {
        // PRESIDENT is mapped to EXECUTIVE.
        // normProjects = projects(3.0) / 30 * 100 = 10%
        // normBudget = budget(100M) / 500M * 100 = 20%
        // legEfficiency = projects(3.0) / bills(0) -> 10%
        // rawScore = 10 * 0.45 + 20 * 0.30 + 10 * 0.20 = 12.5%
        // coa Penalty: freqPenalty = 1 discrepancy * 2 = 2.0
        //             magPenalty = Math.min(30, (flagged(10M) / (100M + 1000))*40)
        //                        = Math.min(30, (10,000,000 / 100,001,000) * 40)
        //                        = Math.min(30, 0.099999 * 40) = 3.99996
        //             totalPenalty = freqPenalty + magPenalty = 5.99996
        // finalScore = 12.5 - 5.99996 = 6.50004%
        double score = dashboardMetricsService.computeWgiCompositeScore(
                "PRESIDENT",
                0.0,
                3.0,
                new BigDecimal("100000000"),
                new BigDecimal("10000000"), // 10M PHP flagged
                1
        );
        assertThat(score).isCloseTo(6.5, org.assertj.core.data.Percentage.withPercentage(0.1));
    }

    @Test
    void verifiesWgiScoreCalculationForViceExecutive() {
        // VICE_PRESIDENT and VICE_MAYOR mapped to VICE_EXECUTIVE.
        // normBills = bills(10) / 50 * 100 = 20%
        // normProjects = projects(6) / 30 * 100 = 20%
        // normBudget = budget(250M) / 500M * 100 = 50%
        // legEfficiency = (normProjects * 0.5 + normBills * 0.5) = (20 * 0.5 + 20 * 0.5) = 20%
        // rawScore = normBills * 0.30 + normProjects * 0.20 + normBudget * 0.25 + legEfficiency * 0.25
        //          = 20 * 0.30 + 20 * 0.20 + 50 * 0.25 + 20 * 0.25
        //          = 6.0 + 4.0 + 12.5 + 5.0 = 27.5%
        // coa Penalty: freqPenalty = 2 discrepancies * 2 = 4.0
        //             magPenalty = 0.0
        //             totalPenalty = 4.0
        // finalScore = 27.5 - 4 = 23.5%
        double score = dashboardMetricsService.computeWgiCompositeScore(
                "VICE_PRESIDENT",
                10.0, // billsAuthored
                6.0, // projectCompletions
                new BigDecimal("250000000"), // trackedBudget
                BigDecimal.ZERO, // totalFlagged
                2 // coaDiscrepancies
        );
        assertThat(score).isEqualTo(23.5);
    }

    @Test
    void verifiesWgiScoreCalculationForLegislative() {
        // SENATOR is mapped to LEGISLATIVE.
        // normBills = bills(25) / 50 * 100 = 50%
        // normBudget = budget(250M) / 500M * 100 = 50%
        // projects = 0, but bills > 0 -> legEfficiency = normProjects*0.5 + normBills*0.5 = 25%
        // rawScore = 50 * 0.35 + 50 * 0.25 + 25 * 0.30 = 17.5 + 12.5 + 7.5 = 37.5%
        // coa Penalty = 0
        // finalScore = 37.5%
        double score = dashboardMetricsService.computeWgiCompositeScore(
                "SENATOR",
                25.0, // billsAuthored
                0.0, // projectCompletions
                new BigDecimal("250000000"), // trackedBudget
                BigDecimal.ZERO, // totalFlagged
                0 // coaDiscrepancies
        );
        assertThat(score).isEqualTo(37.5);
    }
}
