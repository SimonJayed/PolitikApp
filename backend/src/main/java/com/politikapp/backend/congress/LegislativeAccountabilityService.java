package com.politikapp.backend.congress;

import static com.politikapp.backend.congress.LegislativeAccountability.*;

import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.politician.repository.PoliticianRepository;
import com.politikapp.backend.submission.service.CitationUrls;
import java.net.URI;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
class LegislativeAccountabilityService {
    private static final String TABLE = "public.legislative_accountability";
    private static final String PUBLIC = " and verification_status='VERIFIED' and withdrawn_at is null";
    private static final String FIELDS = """
            record_id, kind, chamber, congress, decision, title, reference, event_date, end_date,
            source_url, verification_status, reviewed_at
            """;
    private static final String PRIVATE_FIELDS = FIELDS + ", verification_notes, reviewed_by, withdrawn_at, revision";
    private static final Map<Kind, Set<Decision>> DECISIONS = Map.of(
            Kind.ATTENDANCE, Set.of(Decision.PRESENT, Decision.ABSENT, Decision.EXCUSED, Decision.UNAVAILABLE),
            Kind.VOTE, Set.of(Decision.YES, Decision.NO, Decision.ABSTAINED, Decision.ABSENT, Decision.UNKNOWN),
            Kind.COMMITTEE, Set.of(Decision.CHAIR, Decision.VICE_CHAIR, Decision.MEMBER));

    private final JdbcClient jdbc;
    private final PoliticianRepository politicians;

    LegislativeAccountabilityService(JdbcClient jdbc, PoliticianRepository politicians) {
        this.jdbc = jdbc;
        this.politicians = politicians;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Page<Entry> listPublic(UUID politician, Filter filter) {
        requirePolitician(politician);
        var summaries = filter.kind() == Kind.ATTENDANCE ? attendance(politician, filter) : List.<Attendance>of();
        return list(politician, filter, FIELDS, PUBLIC, LegislativeAccountabilityService::entry, summaries);
    }

    Page<AdminEntry> listAdmin(UUID politician, Filter filter) {
        requirePolitician(politician);
        return list(politician, filter, PRIVATE_FIELDS, "", LegislativeAccountabilityService::adminEntry, List.of());
    }

    Entry getPublic(UUID politician, UUID id) {
        requirePolitician(politician);
        return byId(FIELDS, politician, id, PUBLIC).query(LegislativeAccountabilityService::entry).optional()
                .orElseThrow(LegislativeAccountabilityService::notFound);
    }

    @Transactional
    public AdminEntry create(UUID politician, Input input, UUID admin) {
        requirePolitician(politician);
        UUID id = UUID.randomUUID();
        var values = values(input, admin);
        values.put("id", id);
        values.put("politician", politician);
        jdbc.sql("""
                insert into public.legislative_accountability (
                  record_id, politician_id, kind, chamber, congress, decision, title, reference, event_date, end_date,
                  source_url, verification_status, verification_notes, reviewed_by, reviewed_at, record_key
                ) values (
                  :id, :politician, :kind, :chamber, :congress, :decision, :title, :reference, :eventDate, :endDate,
                  :sourceUrl, :status, :notes, :admin, current_timestamp, :key
                )
                """).params(values).update();
        return getAdmin(politician, id);
    }

    @Transactional
    public AdminEntry update(UUID politician, UUID id, Input input, UUID admin) {
        requirePolitician(politician);
        if (input.revision() == null) throw invalid("Include the record revision when saving a change.");
        var values = values(input, admin);
        values.put("id", id);
        values.put("politician", politician);
        values.put("revision", input.revision());
        int changed = jdbc.sql("""
                update public.legislative_accountability set kind=:kind, chamber=:chamber, congress=:congress,
                  decision=:decision, title=:title, reference=:reference, event_date=:eventDate, end_date=:endDate,
                  source_url=:sourceUrl, verification_status=:status, verification_notes=:notes, reviewed_by=:admin,
                  reviewed_at=current_timestamp, updated_at=current_timestamp, withdrawn_at=null,
                  record_key=:key, revision=revision+1
                where politician_id=:politician and record_id=:id and revision=:revision
                """).params(values).update();
        requireChanged(politician, id, changed);
        return getAdmin(politician, id);
    }

    @Transactional
    public void withdraw(UUID politician, UUID id, long revision) {
        requirePolitician(politician);
        int changed = jdbc.sql("""
                update public.legislative_accountability set withdrawn_at=current_timestamp,
                  updated_at=current_timestamp, revision=revision+1
                where politician_id=:politician and record_id=:id and revision=:revision and withdrawn_at is null
                """).param("politician", politician).param("id", id).param("revision", revision).update();
        requireChanged(politician, id, changed);
    }

    private <T> Page<T> list(UUID politician, Filter filter, String fields, String visibility, RowMapper<T> mapper,
                             List<Attendance> summaries) {
        var params = new HashMap<String, Object>();
        params.put("politician", politician);
        String where = filters(filter, params);
        params.put("limit", filter.limit() + 1);
        params.put("offset", filter.offset());
        var rows = jdbc.sql("select " + fields + " from " + TABLE + " where politician_id=:politician"
                + visibility + where + " order by congress desc, event_date desc nulls last, record_id"
                + " limit :limit offset :offset").params(params).query(mapper).list();
        boolean hasMore = rows.size() > filter.limit();
        return new Page<>(true, hasMore ? rows.subList(0, filter.limit()) : rows, summaries, filter.offset(), hasMore);
    }

    private List<Attendance> attendance(UUID politician, Filter filter) {
        var params = new HashMap<String, Object>();
        params.put("politician", politician);
        String where = filters(filter, params);
        return jdbc.sql("""
                select congress, chamber, decision, count(*) as sessions
                from public.legislative_accountability where politician_id=:politician
                """ + PUBLIC + where + " group by congress, chamber, decision order by congress desc, chamber")
                .params(params).query((rs, row) -> new AttendanceCount(rs.getInt("congress"),
                        Chamber.valueOf(rs.getString("chamber")), Decision.valueOf(rs.getString("decision")),
                        rs.getLong("sessions"))).list().stream()
                .collect(java.util.stream.Collectors.groupingBy(
                        count -> new Term(count.congress(), count.chamber()), java.util.LinkedHashMap::new,
                        java.util.stream.Collectors.toMap(AttendanceCount::decision, AttendanceCount::sessions)))
                .entrySet().stream().map(group -> {
                    long present = group.getValue().getOrDefault(Decision.PRESENT, 0L);
                    long absent = group.getValue().getOrDefault(Decision.ABSENT, 0L);
                    return new Attendance(group.getKey().congress(), group.getKey().chamber(), present, absent,
                            group.getValue().getOrDefault(Decision.EXCUSED, 0L),
                            group.getValue().getOrDefault(Decision.UNAVAILABLE, 0L),
                            present + absent == 0 ? null : present * 100.0 / (present + absent));
                }).toList();
    }

    private record Term(int congress, Chamber chamber) {}
    private record AttendanceCount(int congress, Chamber chamber, Decision decision, long sessions) {}

    private static String filters(Filter filter, Map<String, Object> params) {
        var where = new StringBuilder();
        if (filter.kind() != null) {
            where.append(" and kind=:kind");
            params.put("kind", filter.kind().name());
        }
        if (filter.chamber() != null) {
            where.append(" and chamber=:chamber");
            params.put("chamber", filter.chamber().name());
        }
        if (filter.congress() != null) {
            where.append(" and congress=:congress");
            params.put("congress", filter.congress());
        }
        return where.toString();
    }

    private static Map<String, Object> values(Input input, UUID admin) {
        String title = clean(input.title());
        String reference = clean(input.reference());
        String notes = clean(input.verificationNotes());
        String source = officialUrl(clean(input.sourceUrl()), input.chamber());
        if (!DECISIONS.get(input.kind()).contains(input.decision())) {
            throw invalid("Choose a status that applies to this record type.");
        }
        switch (input.kind()) {
            case ATTENDANCE -> {
                if (input.eventDate() == null || reference == null || title != null || input.endDate() != null) {
                    throw invalid("Attendance requires a session date and session reference.");
                }
            }
            case VOTE -> {
                if (input.eventDate() == null || reference == null || title == null || input.endDate() != null) {
                    throw invalid("A vote requires a measure title, vote reference, and voting date.");
                }
            }
            case COMMITTEE -> {
                if (title == null || reference != null) throw invalid("A committee assignment requires a committee name.");
            }
        }
        // The first Congress under the 1987 Constitution served through June 1992.
        boolean eighthCongress = input.congress() == 8;
        int startYear = eighthCongress ? 1987 : 1992 + (input.congress() - 9) * 3;
        LocalDate termStart = LocalDate.of(startYear, 6, 30);
        LocalDate nextTerm = termStart.plusYears(eighthCongress ? 5 : 3);
        if (!inTerm(input.eventDate(), termStart, nextTerm)
                || (input.endDate() != null && (input.endDate().isBefore(termStart) || input.endDate().isAfter(nextTerm)))
                || (input.eventDate() != null && input.endDate() != null && input.endDate().isBefore(input.eventDate()))) {
            throw invalid("Dates must be in order and fall within the selected congressional term.");
        }
        if (input.verificationStatus() == Verification.VERIFIED && (source == null || notes == null)) {
            throw invalid("A verified record requires an official citation and verification notes.");
        }
        String identity = input.kind() == Kind.COMMITTEE ? title + "|" + input.decision() : reference;
        var values = new HashMap<String, Object>();
        values.put("kind", input.kind().name());
        values.put("chamber", input.chamber().name());
        values.put("congress", input.congress());
        values.put("decision", input.decision().name());
        values.put("title", title);
        values.put("reference", reference);
        values.put("eventDate", input.eventDate());
        values.put("endDate", input.endDate());
        values.put("sourceUrl", source);
        values.put("status", input.verificationStatus().name());
        values.put("notes", notes);
        values.put("admin", admin);
        values.put("key", input.eventDate() + "|" + identity.replaceAll("\\s+", " ").toLowerCase(Locale.ROOT));
        return values;
    }

    private static String officialUrl(String source, Chamber chamber) {
        if (source == null) return null;
        if (!CitationUrls.isWebUrl(source)) throw invalid("Enter a valid official source URL.");
        String canonical = CitationUrls.removeTracking(source);
        URI url = URI.create(canonical);
        String host = url.getHost().toLowerCase(Locale.ROOT);
        String path = url.getPath();
        if (!(host.equals(chamber.domain) || host.endsWith("." + chamber.domain))
                || url.getPort() != -1 || path == null || path.isBlank() || path.equals("/")
                || (path.equalsIgnoreCase("/index.php") && url.getQuery() == null)) {
            throw invalid("Use a document or record on the selected chamber’s official website.");
        }
        return canonical;
    }

    private static boolean inTerm(LocalDate date, LocalDate start, LocalDate end) {
        return date == null || (!date.isBefore(start) && date.isBefore(end));
    }

    private static String clean(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private JdbcClient.StatementSpec byId(String fields, UUID politician, UUID id, String visibility) {
        return jdbc.sql("select " + fields + " from " + TABLE
                + " where politician_id=:politician and record_id=:id" + visibility)
                .param("politician", politician).param("id", id);
    }

    private AdminEntry getAdmin(UUID politician, UUID id) {
        return byId(PRIVATE_FIELDS, politician, id, "").query(LegislativeAccountabilityService::adminEntry).optional()
                .orElseThrow(LegislativeAccountabilityService::notFound);
    }

    private void requireChanged(UUID politician, UUID id, int changed) {
        if (changed == 1) return;
        getAdmin(politician, id);
        throw new HttpResponseException(409, "This record changed. Reload it before trying again.");
    }

    private void requirePolitician(UUID id) {
        politicians.findById(id).filter(p -> !"ARCHIVED".equals(p.getStatus()))
                .orElseThrow(() -> new HttpResponseException(404, "Politician not found."));
    }

    private static Entry entry(ResultSet rs, int index) throws SQLException {
        Chamber chamber = Chamber.valueOf(rs.getString("chamber"));
        String source = rs.getString("source_url");
        return new Entry(rs.getObject("record_id", UUID.class), Kind.valueOf(rs.getString("kind")), chamber,
                rs.getInt("congress"), Decision.valueOf(rs.getString("decision")), rs.getString("title"),
                rs.getString("reference"), rs.getObject("event_date", LocalDate.class),
                rs.getObject("end_date", LocalDate.class), source, source == null ? null : chamber.organization,
                Verification.valueOf(rs.getString("verification_status")), instant(rs, "reviewed_at"));
    }

    private static AdminEntry adminEntry(ResultSet rs, int index) throws SQLException {
        return new AdminEntry(entry(rs, index), rs.getString("verification_notes"),
                rs.getObject("reviewed_by", UUID.class), instant(rs, "withdrawn_at"), rs.getLong("revision"));
    }

    private static Instant instant(ResultSet rs, String column) throws SQLException {
        var value = rs.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }

    private static HttpResponseException invalid(String message) {
        return new HttpResponseException(422, message);
    }

    private static HttpResponseException notFound() {
        return new HttpResponseException(404, "Legislative record not found.");
    }
}
