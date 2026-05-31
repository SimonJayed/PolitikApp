package com.politikapp.backend.module2.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ConsensusService {
    
    @Transactional(propagation = Propagation.REQUIRED)
    public String determineModerationOutcome(long agreeSum, long disagreeSum, String currentStatus) {
        if (agreeSum >= 10 && (agreeSum >= disagreeSum * 2)) {
            return "PUBLISHED";
        } else if (disagreeSum >= 10 && (disagreeSum >= agreeSum * 2)) {
            return "REJECTED";
        }
        return currentStatus;
    }

    public double calculateAgreementRatio(long agreeSum, long disagreeSum) {
        long total = agreeSum + disagreeSum;
        if (total == 0) return 0.0;
        return ((double) agreeSum / total) * 100.0;
    }

    public boolean checkConsensusThreshold(long agreeSum, long disagreeSum) {
        return (agreeSum >= 10 && agreeSum >= disagreeSum * 2) || (disagreeSum >= 10 && disagreeSum >= agreeSum * 2);
    }
}
