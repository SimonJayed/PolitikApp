package com.politikapp.backend.module3.service;

import org.springframework.stereotype.Service;

@Service
public class AccuracyMetricService {
    
    public double computeAccuracyPercentage(long correctVotes, long totalTerminalVotes) {
        if (totalTerminalVotes == 0) {
            return returnDefaultAccuracyValue();
        }
        return ((double) correctVotes / totalTerminalVotes) * 100.0;
    }

    public double preventInvalidAccuracyCalculation() {
        return 0.0;
    }

    public double handleMissingParticipationData() {
        return 0.0;
    }

    public double returnDefaultAccuracyValue() {
        return 0.0;
    }
}
