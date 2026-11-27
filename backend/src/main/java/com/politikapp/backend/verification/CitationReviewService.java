package com.politikapp.backend.verification;

import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.submission.service.CitationUrls;
import com.politikapp.backend.submission.service.SourceValidationService;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class CitationReviewService {
    public enum RecordType {
        PROFILE("politicians", "politician_id"),
        TIMELINE("timeline_entries", "timeline_id"),
        SUBMISSION("profile_edit_submissions", "submission_id"),
        ACCOMPLISHMENT("politician_accomplishments", "accomplishment_id");

        private final String table;
        private final String key;

        RecordType(String table, String key) {
            this.table = table;
            this.key = key;
        }
    }

    public enum Status { VERIFIED, PENDING_VERIFICATION, UNVERIFIED, INVALID_SOURCE }
    public enum Attribution { DIRECT, ASSOCIATED_AGENCY, UNCONFIRMED }

    public record ReviewRequest(@NotNull Status status, @Size(max = 2048) String sourceUrl,
            @Size(max = 200) String sourceOrganization, @Size(max = 5000) String verificationNotes,
            Attribution attribution, @NotNull Instant recordUpdatedAt, Instant reviewedAt) {}
    public record AdminRecord(RecordType type, UUID id, UUID politicianId, String politicianName,
            String title, String description, String facts, String publicationStatus, String originalSourceUrl, Instant recordUpdatedAt,
            Status status, String sourceUrl, String sourceOrganization, String verificationNotes,
            Attribution attribution, Instant reviewedAt) {}
    public record PublicReview(RecordType type, UUID id, Status status, String sourceUrl,
            String sourceOrganization, Attribution attribution, Instant reviewedAt) {}
    public record Page(List<AdminRecord> records, int offset, boolean hasMore) {}

    private static final String RECORDS = """
            with records as (
                select 'PROFILE' as record_type, p.politician_id as record_id, p.politician_id,
                    p.full_name as title, p.biography as description, cast(null as varchar) as original_source_url,
                    concat_ws(' · ', p.position, p.jurisdiction, cast(p.term_start as varchar), cast(p.term_end as varchar)) as facts,
                    p.status as publication_status, coalesce(p.updated_at, p.created_at) as record_updated_at,
                    (p.status is distinct from 'ARCHIVED') as public_visible
                from public.politicians p
                union all
                select 'TIMELINE', t.timeline_id, t.politician_id, t.action_identifier,
                    t.summary, t.source_url, cast(t.action_details as varchar), t.publication_status, coalesce(t.updated_at, t.created_at),
                    (t.publication_status='PUBLISHED' and not t.is_hidden)
                from public.timeline_entries t
                union all
                select 'SUBMISSION', s.submission_id, s.politician_id, s.action_identifier,
                    s.impact_summary, s.source_url, cast(s.action_details as varchar), s.status, coalesce(s.updated_at, s.created_at), false
                from public.profile_edit_submissions s
                union all
                select 'ACCOMPLISHMENT', a.accomplishment_id, a.politician_id, a.title,
                    a.description, a.source_url, concat_ws(' · ', a.category, cast(a.accomplishment_date as varchar),
                        cast(a.accomplishment_year as varchar)), case when a.visible then 'VISIBLE' else 'HIDDEN' end,
                    coalesce(a.updated_at, a.created_at), a.visible
                from public.politician_accomplishments a
            ),
            review_queue as (
                select r.*, p.full_name as politician_name, p.status as profile_status,
                    coalesce(v.verification_status, 'UNVERIFIED') as verification_status,
                    v.source_url, v.source_organization, v.verification_notes, v.attribution, v.reviewed_at
                from records r left join public.politicians p on p.politician_id=r.politician_id
                left join public.citation_reviews v on v.record_type=r.record_type and v.record_id=r.record_id
                    and v.record_updated_at=r.record_updated_at
            )
            """;

    private final JdbcTemplate jdbc;
    private final SourceValidationService sourceValidation;

    public CitationReviewService(JdbcTemplate jdbc, SourceValidationService sourceValidation) {
        this.jdbc = jdbc;
        this.sourceValidation = sourceValidation;
    }

    public Page list(RecordType type, Status status, UUID recordId, boolean missingSource, boolean needsReview, int offset, int limit) {
        if (offset < 0 || limit < 1 || limit > 100) throw new HttpResponseException(400, "Invalid page bounds.");
        var rows = jdbc.query(RECORDS + """
                select * from review_queue
                where record_type=coalesce(?,record_type)
                  and verification_status=coalesce(?,verification_status)
                  and record_id=coalesce(cast(? as uuid),record_id)
                  and (not ? or coalesce(nullif(trim(source_url), ''), nullif(trim(original_source_url), '')) is null)
                  and (not ? or verification_status<>'VERIFIED')
                order by record_updated_at desc nulls last, record_type, record_id
                limit ? offset ?
                """, this::readAdminRecord, type == null ? null : type.name(),
                status == null ? null : status.name(), recordId, missingSource, needsReview && status == null, limit + 1, offset);
        return new Page(rows.stream().limit(limit).toList(), offset, rows.size() > limit);
    }

    public List<PublicReview> publicReviews(UUID politicianId) {
        return jdbc.query(RECORDS + """
                select record_type, record_id, verification_status, source_url, source_organization, attribution, reviewed_at
                from review_queue where politician_id=? and public_visible
                    and politician_name is not null and profile_status is distinct from 'ARCHIVED' and reviewed_at is not null
                """, (rs, index) -> {
            var status = Status.valueOf(rs.getString("verification_status"));
            return new PublicReview(RecordType.valueOf(rs.getString("record_type")), rs.getObject("record_id", UUID.class),
                    status, status == Status.VERIFIED ? rs.getString("source_url") : null,
                    status == Status.VERIFIED ? rs.getString("source_organization") : null,
                    status == Status.VERIFIED ? attribution(rs) : null, instant(rs, "reviewed_at"));
        }, politicianId);
    }

    @Transactional
    public AdminRecord save(RecordType type, UUID id, ReviewRequest request, UUID admin) {
        var locked = jdbc.query("select " + type.key + " from public." + type.table + " where " + type.key + "=? for update",
                (rs, index) -> rs.getObject(1, UUID.class), id);
        if (locked.isEmpty()) throw new HttpResponseException(404, "Review record not found.");
        var record = find(type, id);
        if (!Objects.equals(record.recordUpdatedAt(), request.recordUpdatedAt())
                || !Objects.equals(record.reviewedAt(), request.reviewedAt())) {
            throw new HttpResponseException(409, "The record or its review changed. Reload it before saving.");
        }

        String url = clean(request.sourceUrl());
        String organization = clean(request.sourceOrganization());
        String notes = clean(request.verificationNotes());
        if (url != null) {
            if (!CitationUrls.isWebUrl(url)) throw new HttpResponseException(422, "Enter an absolute HTTP or HTTPS citation.");
            if (type == RecordType.ACCOMPLISHMENT || type == RecordType.SUBMISSION) sourceValidation.validateSourceUrl(url);
            url = CitationUrls.removeTracking(url);
        }
        if (request.status() == Status.VERIFIED && (url == null || organization == null || notes == null)) {
            throw new HttpResponseException(422, "A verified review requires a citation, source organization, and evidence notes.");
        }
        if (request.status() == Status.VERIFIED && (type == RecordType.TIMELINE || type == RecordType.SUBMISSION)
                && "COA_FINDING".equals(record.title())
                && (request.attribution() == null || request.attribution() == Attribution.UNCONFIRMED)) {
            throw new HttpResponseException(422, "Record whether the COA finding is directly attributable or concerns an associated agency.");
        }

        var checkedAt = OffsetDateTime.ofInstant(Instant.now().truncatedTo(ChronoUnit.MICROS), ZoneOffset.UTC);
        var version = OffsetDateTime.ofInstant(request.recordUpdatedAt(), ZoneOffset.UTC);
        var attribution = request.attribution() == null ? null : request.attribution().name();
        int updated = jdbc.update("""
                update public.citation_reviews set verification_status=?, source_url=?, source_organization=?,
                    verification_notes=?, attribution=?, record_updated_at=?, reviewed_at=?, reviewed_by=?
                where record_type=? and record_id=?
                """, request.status().name(), url, organization, notes, attribution, version, checkedAt, admin, type.name(), id);
        if (updated == 0) {
            jdbc.update("""
                    insert into public.citation_reviews(record_type, record_id, verification_status, source_url,
                        source_organization, verification_notes, attribution, record_updated_at, reviewed_at, reviewed_by)
                    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, type.name(), id, request.status().name(), url, organization, notes, attribution, version, checkedAt, admin);
        }
        return find(type, id);
    }

    private AdminRecord find(RecordType type, UUID id) {
        return jdbc.query(RECORDS + "select * from review_queue where record_type=? and record_id=?",
                this::readAdminRecord, type.name(), id).stream().findFirst()
                .orElseThrow(() -> new HttpResponseException(404, "Review record not found."));
    }

    private AdminRecord readAdminRecord(ResultSet rs, int index) throws SQLException {
        return new AdminRecord(RecordType.valueOf(rs.getString("record_type")), rs.getObject("record_id", UUID.class),
                rs.getObject("politician_id", UUID.class), rs.getString("politician_name"),
                rs.getString("title"), rs.getString("description"), rs.getString("facts"), rs.getString("publication_status"),
                rs.getString("original_source_url"), instant(rs, "record_updated_at"),
                Status.valueOf(rs.getString("verification_status")), rs.getString("source_url"),
                rs.getString("source_organization"), rs.getString("verification_notes"), attribution(rs),
                instant(rs, "reviewed_at"));
    }

    private static Attribution attribution(ResultSet rs) throws SQLException {
        String value = rs.getString("attribution");
        return value == null ? null : Attribution.valueOf(value);
    }

    private static Instant instant(ResultSet rs, String column) throws SQLException {
        var value = rs.getObject(column, OffsetDateTime.class);
        return value == null ? null : value.toInstant();
    }

    private static String clean(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
