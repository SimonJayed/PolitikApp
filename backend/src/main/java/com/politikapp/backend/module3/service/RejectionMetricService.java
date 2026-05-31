package com.politikapp.backend.module3.service;

import org.springframework.stereotype.Service;

@Service
public class RejectionMetricService {
    private static final double LOCK_THRESHOLD = 15.0;

    public double computeRejectionMetric(long rejectedCount, long totalCount) {
        if (totalCount == 0) {
            return handleZeroRejectedSubmissions();
        }
        return ((double) rejectedCount / totalCount) * 100.0;
    }

    public double handleZeroRejectedSubmissions() {
        return 0.0;
    }

    public double preventInvalidDivision() {
        return 0.0;
    }

    public boolean evaluateRejectionThreshold(double rejectionMetric) {
        return rejectionMetric > LOCK_THRESHOLD;
    }
}
