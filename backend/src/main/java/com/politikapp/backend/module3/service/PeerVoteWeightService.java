package com.politikapp.backend.module3.service;

import com.politikapp.backend.module3.dto.VoteWeightResponse;
import com.politikapp.backend.module3.entity.JuryVoteTrustRecord;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PeerVoteWeightService {
    public static final String DEFAULT_WEIGHT_MESSAGE =
            "Vote weight service unavailable. Default vote weight applied.";
    public static final String EVALUATED_MESSAGE = "Vote weight resolved.";

    private static final Logger log = LoggerFactory.getLogger(PeerVoteWeightService.class);
    private static final int DEFAULT_VOTE_WEIGHT = 1;

    private final AccuracyTrackingService accuracyTrackingService;
    private final AccuracyMetricService accuracyMetricService;
    private final VoteWeightService voteWeightService;

    public PeerVoteWeightService(
            AccuracyTrackingService accuracyTrackingService,
            AccuracyMetricService accuracyMetricService,
            VoteWeightService voteWeightService
    ) {
        this.accuracyTrackingService = accuracyTrackingService;
        this.accuracyMetricService = accuracyMetricService;
        this.voteWeightService = voteWeightService;
    }

    @Transactional(readOnly = true)
    public VoteWeightResponse resolveVoteWeight(UUID peerId) {
        if (peerId == null) {
            log.warn("Module 3 vote weight resolver defaulted because peerId was missing.");
            return defaultResponse(null);
        }

        try {
            List<JuryVoteTrustRecord> votes = accuracyTrackingService.getModerationParticipationRecords(peerId);
            if (votes.isEmpty()) {
                log.warn("Module 3 vote weight resolver defaulted because peer {} has no vote history.", peerId);
                return defaultResponse(peerId);
            }

            long correctCount = accuracyTrackingService.getCorrectVoteCount(votes);
            long incorrectCount = accuracyTrackingService.getIncorrectVoteCount(votes);
            long totalCount = correctCount + incorrectCount;

            if (totalCount == 0) {
                log.warn("Module 3 vote weight resolver defaulted because peer {} has no terminal vote history.", peerId);
                return defaultResponse(peerId);
            }

            double historicalPrecision = accuracyMetricService.computeAccuracyPercentage(correctCount, totalCount);
            int voteWeight = voteWeightService.resolveVoteWeight(historicalPrecision);

            return new VoteWeightResponse(peerId, voteWeight, historicalPrecision, false, EVALUATED_MESSAGE);
        } catch (Exception exception) {
            log.warn("Module 3 vote weight resolver failed for peer {}.", peerId, exception);
            return defaultResponse(peerId);
        }
    }

    private VoteWeightResponse defaultResponse(UUID peerId) {
        return new VoteWeightResponse(peerId, DEFAULT_VOTE_WEIGHT, 0.0, true, DEFAULT_WEIGHT_MESSAGE);
    }
}
