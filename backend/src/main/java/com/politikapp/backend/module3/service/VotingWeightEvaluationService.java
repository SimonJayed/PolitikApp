package com.politikapp.backend.module3.service;

import com.politikapp.backend.module3.entity.JuryVoteTrustRecord;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class VotingWeightEvaluationService {
    private static final Logger log = LoggerFactory.getLogger(VotingWeightEvaluationService.class);
    
    private final AccuracyTrackingService accuracyTrackingService;
    private final AccuracyMetricService accuracyMetricService;
    private final VoteWeightService voteWeightService;

    public VotingWeightEvaluationService(
            AccuracyTrackingService accuracyTrackingService,
            AccuracyMetricService accuracyMetricService,
            VoteWeightService voteWeightService
    ) {
        this.accuracyTrackingService = accuracyTrackingService;
        this.accuracyMetricService = accuracyMetricService;
        this.voteWeightService = voteWeightService;
    }

    public void monitorModerationParticipation(UUID peerId) {
        log.info("Monitoring moderation participation for peer={}", peerId);
    }

    @Transactional(readOnly = true)
    public int startVotingWeightEvaluation(UUID peerId) {
        log.info("Starting voting weight evaluation for peer ID={}", peerId);
        List<JuryVoteTrustRecord> votes = accuracyTrackingService.getModerationParticipationRecords(peerId);
        
        long correctCount = accuracyTrackingService.getCorrectVoteCount(votes);
        long incorrectCount = accuracyTrackingService.getIncorrectVoteCount(votes);
        long totalCount = correctCount + incorrectCount;

        double accuracy = accuracyMetricService.computeAccuracyPercentage(correctCount, totalCount);
        return voteWeightService.resolveVoteWeight(accuracy);
    }
}
