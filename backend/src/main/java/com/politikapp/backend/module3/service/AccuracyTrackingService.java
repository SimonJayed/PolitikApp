package com.politikapp.backend.module3.service;

import com.politikapp.backend.module3.entity.JuryVoteTrustRecord;
import com.politikapp.backend.module3.entity.ModerationOutcomeRecord;
import com.politikapp.backend.module3.repository.JuryVoteTrustRecordRepository;
import com.politikapp.backend.module3.repository.ModerationOutcomeRecordRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AccuracyTrackingService {
    private static final Logger log = LoggerFactory.getLogger(AccuracyTrackingService.class);
    private final JuryVoteTrustRecordRepository voteRepository;
    private final ModerationOutcomeRecordRepository moderationRepository;

    public AccuracyTrackingService(
            JuryVoteTrustRecordRepository voteRepository,
            ModerationOutcomeRecordRepository moderationRepository
    ) {
        this.voteRepository = voteRepository;
        this.moderationRepository = moderationRepository;
    }

    @Transactional(readOnly = true)
    public List<JuryVoteTrustRecord> getModerationParticipationRecords(UUID peerId) {
        return voteRepository.findByPeerId(peerId);
    }

    public long getCorrectVoteCount(List<JuryVoteTrustRecord> votes) {
        long alignedCount = 0;
        for (JuryVoteTrustRecord vote : votes) {
            Optional<ModerationOutcomeRecord> outcome = moderationRepository.findById(vote.getQueueId());
            if (outcome.isPresent() && isTerminalStatus(outcome.get().getQueueStatus())) {
                if (isAligned(vote.getVoteType(), outcome.get().getQueueStatus())) {
                    alignedCount++;
                }
            }
        }
        return alignedCount;
    }

    public long getIncorrectVoteCount(List<JuryVoteTrustRecord> votes) {
        long opposedCount = 0;
        for (JuryVoteTrustRecord vote : votes) {
            Optional<ModerationOutcomeRecord> outcome = moderationRepository.findById(vote.getQueueId());
            if (outcome.isPresent() && isTerminalStatus(outcome.get().getQueueStatus())) {
                if (!isAligned(vote.getVoteType(), outcome.get().getQueueStatus())) {
                    opposedCount++;
                }
            }
        }
        return opposedCount;
    }

    public boolean checkMissingAccuracyData(List<JuryVoteTrustRecord> votes) {
        return votes.isEmpty();
    }

    public boolean compareVotesWithFinalOutcome(String voteType, String finalStatus) {
        return isAligned(voteType, finalStatus);
    }

    private boolean isTerminalStatus(String queueStatus) {
        return "PUBLISHED".equals(queueStatus) || "REJECTED".equals(queueStatus);
    }

    private boolean isAligned(String voteType, String queueStatus) {
        return ("AGREE".equals(voteType) && "PUBLISHED".equals(queueStatus))
                || ("DISAGREE".equals(voteType) && "REJECTED".equals(queueStatus));
    }
}
