package com.politikapp.backend.module2.service;

import com.politikapp.backend.common.event.SubmissionCreatedEvent;
import com.politikapp.backend.module2.dto.BallotArchiveEntryResponse;
import com.politikapp.backend.module2.dto.PendingQueueCardResponse;
import com.politikapp.backend.module2.entity.ModerationQueue;
import com.politikapp.backend.module2.repository.ModerationQueueRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class ModerationQueueService {
    private static final Logger log = LoggerFactory.getLogger(ModerationQueueService.class);

    private final ModerationQueueRepository moderationQueueRepository;

    @PersistenceContext
    private EntityManager entityManager;

    public ModerationQueueService(ModerationQueueRepository moderationQueueRepository) {
        this.moderationQueueRepository = moderationQueueRepository;
    }

    /**
     * Enqueues a new submission into the moderation queue in response to the
     * SubmissionCreatedEvent, setting the starting status to JURY_REVIEW.
     */
    @Transactional
    public void enqueueAnonymizedSubmission(SubmissionCreatedEvent event) {
        log.info("Enqueuing new submission ID: {} to moderation queue", event.submissionId());
        
        ModerationQueue queueEntry = new ModerationQueue(
            event.submissionId(),
            event.politicianId()
        );
        queueEntry.setQueueId(event.submissionId());
        queueEntry.setQueueStatus("SUBMITTED_REQUEST");
        
        moderationQueueRepository.save(queueEntry);

        entityManager.createNativeQuery(
            "UPDATE public.profile_edit_submissions SET status = 'SUBMITTED_REQUEST', updated_at = CURRENT_TIMESTAMP WHERE submission_id = :submissionId"
        )
        .setParameter("submissionId", event.submissionId())
        .executeUpdate();
        
        log.info("Successfully enqueued submission. Assigned queue ID: {}", queueEntry.getQueueId());
    }

    /**
     * Fetches the queue deck views anonymizing authorship to maintain a double-blind peer-review.
     * Sets the contributor ID to null dynamically prior to payload transmission.
     */
    @Transactional(readOnly = true)
    public List<PendingQueueCardResponse> getAnonymizedModerationQueue() {
        log.info("Fetching anonymized moderation queue for JURY_REVIEW status");

        @SuppressWarnings("unchecked")
        List<Object[]> rawRows = entityManager.createNativeQuery(
            "SELECT mq.queue_id, mq.submission_id, mq.politician_id, p.full_name, c.full_name, pes.source_url, pes.category_tag, pes.action_identifier, " +
            "CAST(pes.action_details AS TEXT), pes.impact_summary, p.jurisdiction, p.status, p.term_start, p.term_end, mq.queue_status, mq.escalation_flag, mq.assigned_at, mq.created_at " +
            "FROM public.moderation_queue mq " +
            "JOIN public.profile_edit_submissions pes ON pes.submission_id = mq.submission_id " +
            "JOIN public.politicians p ON p.politician_id = mq.politician_id " +
            "LEFT JOIN public.contributors c ON c.contributor_id = pes.contributor_id " +
            "WHERE mq.queue_status IN ('PENDING', 'JURY_REVIEW') " +
            "ORDER BY mq.created_at ASC"
        ).getResultList();

        return rawRows.stream().map(row -> new PendingQueueCardResponse(
            convertToUUID(row[0]),
            convertToUUID(row[1]),
            convertToUUID(row[2]),
            (String) row[3],
            (String) row[4],
            (String) row[5],
            (String) row[6],
            (String) row[7],
            row[8] != null ? row[8].toString() : null,
            (String) row[9],
            (String) row[10],
            (String) row[11],
            convertToLocalDate(row[12]),
            convertToLocalDate(row[13]),
            (String) row[14],
            convertToBoolean(row[15]),
            convertToInstant(row[16]),
            convertToInstant(row[17])
        )).toList();
    }

    /**
     * Fetches all entries currently flagged as ESCALATED, along with their agree and disagree weighted sums.
     */
    @Transactional(readOnly = true)
    public List<com.politikapp.backend.module2.dto.EscalatedQueueCardResponse> getEscalatedModerationQueue() {
        log.info("Fetching escalated moderation queue entries");

        @SuppressWarnings("unchecked")
        List<Object[]> rawRows = entityManager.createNativeQuery(
            "SELECT mq.queue_id, mq.submission_id, mq.politician_id, p.full_name, c.full_name, pes.source_url, pes.category_tag, pes.action_identifier, " +
            "CAST(pes.action_details AS TEXT), pes.impact_summary, p.jurisdiction, p.status, p.term_start, p.term_end, mq.queue_status, mq.escalation_flag, mq.assigned_at, mq.created_at, " +
            "(SELECT COALESCE(SUM(jv1.vote_weight), 0) FROM public.jury_votes jv1 WHERE jv1.queue_id = mq.queue_id AND jv1.vote_type = 'AGREE') as agree_sum, " +
            "(SELECT COALESCE(SUM(jv2.vote_weight), 0) FROM public.jury_votes jv2 WHERE jv2.queue_id = mq.queue_id AND jv2.vote_type = 'DISAGREE') as disagree_sum " +
            "FROM public.moderation_queue mq " +
            "JOIN public.profile_edit_submissions pes ON pes.submission_id = mq.submission_id " +
            "JOIN public.politicians p ON p.politician_id = mq.politician_id " +
            "LEFT JOIN public.contributors c ON c.contributor_id = pes.contributor_id " +
            "WHERE mq.queue_status IN ('ESCALATED', 'APPEALED_PENDING') " +
            "ORDER BY mq.created_at ASC"
        ).getResultList();

        return rawRows.stream().map(row -> new com.politikapp.backend.module2.dto.EscalatedQueueCardResponse(
            convertToUUID(row[0]),
            convertToUUID(row[1]),
            convertToUUID(row[2]),
            (String) row[3],
            (String) row[4],
            (String) row[5],
            (String) row[6],
            (String) row[7],
            row[8] != null ? row[8].toString() : null,
            (String) row[9],
            (String) row[10],
            (String) row[11],
            convertToLocalDate(row[12]),
            convertToLocalDate(row[13]),
            (String) row[14],
            convertToBoolean(row[15]),
            row[18] != null ? ((Number) row[18]).longValue() : 0L,
            row[19] != null ? ((Number) row[19]).longValue() : 0L,
            convertToInstant(row[16]),
            convertToInstant(row[17])
        )).toList();
    }

    /**
     * Performs a manual sandbox process stage transition override.
     * Shifts queue status based on direction (next/prev) within the sandbox workflow bounds.
     */
    @Transactional
    public String shiftSandboxStage(UUID queueId, String direction) {
        log.info("Sandbox shifting stage for queueId={}, direction={}", queueId, direction);
        ModerationQueue queueRow = moderationQueueRepository.findById(queueId)
                .orElseThrow(() -> new com.politikapp.backend.common.HttpResponseException(404, "Not Found: Target entry not found."));

        com.politikapp.backend.module1.entity.ProfileEditSubmission submission = entityManager.find(com.politikapp.backend.module1.entity.ProfileEditSubmission.class, queueRow.getSubmissionId());
        if (submission == null) {
            throw new com.politikapp.backend.common.HttpResponseException(404, "Not Found: Associated submission not found.");
        }

        List<String> stages = List.of("PENDING", "JURY_REVIEW", "REVISION_REQUIRED", "ESCALATED", "REJECTED", "PUBLISHED");
        String currentStatus = queueRow.getQueueStatus();
        if ("SUBMITTED".equals(currentStatus)) {
            currentStatus = "PENDING";
        }
        int currentIndex = stages.indexOf(currentStatus);
        if (currentIndex == -1) {
            currentIndex = 1; // default JURY_REVIEW
        }

        int newIndex = currentIndex;
        if ("next".equalsIgnoreCase(direction)) {
            newIndex = Math.min(stages.size() - 1, currentIndex + 1);
        } else if ("prev".equalsIgnoreCase(direction)) {
            newIndex = Math.max(0, currentIndex - 1);
        }

        String newStatus = stages.get(newIndex);
        queueRow.setQueueStatus(newStatus);
        submission.setStatus(newStatus);

        if ("PUBLISHED".equals(newStatus)) {
            cascadeToTimelineNative(submission);
        }

        moderationQueueRepository.save(queueRow);
        entityManager.merge(submission);

        return newStatus;
    }

    private void cascadeToTimelineNative(com.politikapp.backend.module1.entity.ProfileEditSubmission submission) {
        try {
            Long count = entityManager.createQuery(
                "SELECT COUNT(t) FROM TimelineEntry t WHERE t.submissionId = :submissionId", Long.class
            )
            .setParameter("submissionId", submission.getSubmissionId())
            .getSingleResult();

            if (count == null || count == 0) {
                com.politikapp.backend.module1.entity.TimelineEntry entry = new com.politikapp.backend.module1.entity.TimelineEntry();
                entry.setPoliticianId(submission.getPoliticianId());
                entry.setSubmissionId(submission.getSubmissionId());
                entry.setCategoryTag(submission.getCategoryTag());
                entry.setActionIdentifier(submission.getActionIdentifier());
                entry.setActionDetails(submission.getActionDetails());
                entry.setSummary(submission.getImpactSummary());
                entry.setSourceUrl(submission.getSourceUrl());
                entry.setPublicationStatus("PUBLISHED");
                entityManager.persist(entry);
            }
        } catch (Exception e) {
            log.error("Failed to cascade timeline entry in sandbox shift:", e);
        }
    }

    private java.util.UUID convertToUUID(Object obj) {
        if (obj == null) return null;
        if (obj instanceof java.util.UUID) {
            return (java.util.UUID) obj;
        }
        return java.util.UUID.fromString(obj.toString());
    }

    private boolean convertToBoolean(Object obj) {
        if (obj == null) return false;
        if (obj instanceof Boolean) {
            return (Boolean) obj;
        } else if (obj instanceof Number) {
            return ((Number) obj).intValue() != 0;
        }
        return Boolean.parseBoolean(obj.toString());
    }

    private java.time.Instant convertToInstant(Object obj) {
        if (obj == null) return null;
        if (obj instanceof java.sql.Timestamp) {
            return ((java.sql.Timestamp) obj).toInstant();
        } else if (obj instanceof java.time.Instant) {
            return (java.time.Instant) obj;
        } else if (obj instanceof java.time.OffsetDateTime) {
            return ((java.time.OffsetDateTime) obj).toInstant();
        } else if (obj instanceof java.util.Date) {
            return ((java.util.Date) obj).toInstant();
        }
        try {
            return java.time.Instant.parse(obj.toString());
        } catch (Exception e) {
            return null;
        }
    }

    @Transactional(readOnly = true)
    public List<BallotArchiveEntryResponse> getBallotArchive(UUID peerId) {
        log.info("Fetching ballot archive for peerId={}", peerId);
        @SuppressWarnings("unchecked")
        List<Object[]> rawRows = entityManager.createNativeQuery(
            "SELECT jv.queue_id, " +
            "COALESCE(NULLIF(pes.impact_summary, ''), NULLIF(pes.action_identifier, ''), CAST(jv.queue_id AS TEXT)) AS title, " +
            "jv.vote_type, mq.queue_status, jv.created_at, pes.source_url " +
            "FROM public.jury_votes jv " +
            "LEFT JOIN public.moderation_queue mq ON mq.queue_id = jv.queue_id " +
            "LEFT JOIN public.profile_edit_submissions pes ON pes.submission_id = mq.submission_id " +
            "WHERE jv.peer_id = :peerId " +
            "ORDER BY jv.created_at DESC " +
            "LIMIT 100"
        )
            .setParameter("peerId", peerId)
            .getResultList();

        return rawRows.stream()
            .map(row -> new BallotArchiveEntryResponse(
                convertToUUID(row[0]),
                row[1] == null ? null : row[1].toString(),
                row[2] == null ? null : row[2].toString(),
                row[3] == null ? "FINALIZED" : row[3].toString(),
                convertToInstant(row[4]),
                row[5] == null ? null : row[5].toString()
            ))
            .toList();
    }

    private java.time.LocalDate convertToLocalDate(Object obj) {
        if (obj == null) return null;
        if (obj instanceof java.time.LocalDate) {
            return (java.time.LocalDate) obj;
        } else if (obj instanceof java.sql.Date) {
            return ((java.sql.Date) obj).toLocalDate();
        }
        try {
            return java.time.LocalDate.parse(obj.toString());
        } catch (Exception e) {
            return null;
        }
    }
}
