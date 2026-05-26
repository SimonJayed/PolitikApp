package com.politikapp.backend.module3.service;

import com.politikapp.backend.module3.dto.VoteWeightResponse;
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
public class PeerVoteWeightService {
    public static final String DEFAULT_WEIGHT_MESSAGE =
            "Vote weight service unavailable. Default vote weight applied.";
    public static final String EVALUATED_MESSAGE = "Vote weight resolved.";

    private static final Logger log = LoggerFactory.getLogger(PeerVoteWeightService.class);
    private static final double ACCELERATION_THRESHOLD = 90.0;
    private static final int DEFAULT_VOTE_WEIGHT = 1;
    private static final int ACCELERATED_VOTE_WEIGHT = 5;

    private final JuryVoteTrustRecordRepository voteRepository;
    private final ModerationOutcomeRecordRepository moderationRepository;

    public PeerVoteWeightService(
            JuryVoteTrustRecordRepository voteRepository,
            ModerationOutcomeRecordRepository moderationRepository
    ) {
        this.voteRepository = voteRepository;
        this.moderationRepository = moderationRepository;
    }

    @Transactional(readOnly = true)
    public VoteWeightResponse resolveVoteWeight(UUID peerId) {
        if (peerId == null) {
            log.warn("Module 3 vote weight resolver defaulted because peerId was missing.");
            return defaultResponse(null);
        }

        try {
            List<JuryVoteTrustRecord> votes = voteRepository.findByPeerId(peerId);
            if (votes.isEmpty()) {
                log.warn("Module 3 vote weight resolver defaulted because peer {} has no vote history.", peerId);
                return defaultResponse(peerId);
            }

            int terminalVotes = 0;
            int alignedVotes = 0;
            for (JuryVoteTrustRecord vote : votes) {
                Optional<ModerationOutcomeRecord> moderationOutcome = moderationRepository.findById(vote.getQueueId());
                if (moderationOutcome.isEmpty()) {
                    continue;
                }

                String queueStatus = moderationOutcome.get().getQueueStatus();
                if (!isTerminalStatus(queueStatus)) {
                    continue;
                }

                terminalVotes++;
                if (isAligned(vote.getVoteType(), queueStatus)) {
                    alignedVotes++;
                }
            }

            if (terminalVotes == 0) {
                log.warn("Module 3 vote weight resolver defaulted because peer {} has no terminal vote history.", peerId);
                return defaultResponse(peerId);
            }

            double historicalPrecision = ((double) alignedVotes / terminalVotes) * 100;
            int voteWeight = historicalPrecision >= ACCELERATION_THRESHOLD
                    ? ACCELERATED_VOTE_WEIGHT
                    : DEFAULT_VOTE_WEIGHT;

            return new VoteWeightResponse(peerId, voteWeight, historicalPrecision, false, EVALUATED_MESSAGE);
        } catch (Exception exception) {
            log.warn("Module 3 vote weight resolver failed for peer {}.", peerId, exception);
            return defaultResponse(peerId);
        }
    }

    private boolean isTerminalStatus(String queueStatus) {
        return "PUBLISHED".equals(queueStatus) || "REJECTED".equals(queueStatus);
    }

    private boolean isAligned(String voteType, String queueStatus) {
        return ("AGREE".equals(voteType) && "PUBLISHED".equals(queueStatus))
                || ("DISAGREE".equals(voteType) && "REJECTED".equals(queueStatus));
    }

    private VoteWeightResponse defaultResponse(UUID peerId) {
        return new VoteWeightResponse(peerId, DEFAULT_VOTE_WEIGHT, 0.0, true, DEFAULT_WEIGHT_MESSAGE);
    }
}
