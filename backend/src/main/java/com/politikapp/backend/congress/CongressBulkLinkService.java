package com.politikapp.backend.congress;

import com.politikapp.backend.common.HttpResponseException;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Applies only explicitly supplied, freshly revalidated identity matches. */
@Service
public class CongressBulkLinkService {
    public record Link(UUID politicianId, String personId) {}
    public record Result(int requested, int linked, int alreadyLinked) {}

    private final JdbcTemplate jdbc;

    public CongressBulkLinkService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Transactional
    public Result link(List<Link> approved) {
        return jdbc.execute((org.springframework.jdbc.core.ConnectionCallback<Result>)
                connection -> applyApproved(connection, approved));
    }

    /** Caller must supply a transaction; every requested link succeeds or none do. */
    public static Result applyApproved(Connection connection, List<Link> approved) throws SQLException {
        if (approved == null || approved.isEmpty()) throw new HttpResponseException(400, "No approved links supplied.");
        if (approved.size() > 100 || approved.stream().anyMatch(link -> link == null
                || link.politicianId() == null || link.personId() == null || link.personId().isBlank())) {
            throw new HttpResponseException(400, "Invalid approved link list.");
        }
        var profileIds = new HashSet<UUID>();
        var personIds = new HashSet<String>();
        for (Link link : approved) {
            if (!profileIds.add(link.politicianId()) || !personIds.add(link.personId())) {
                throw new HttpResponseException(400, "Duplicate profile or source person in approved links.");
            }
        }

        // Serialize the identity check with profile edits and other identity links.
        try (var profiles = connection.prepareStatement("select politician_id from public.politicians where status <> 'ARCHIVED' order by politician_id for update");
             var rows = profiles.executeQuery()) { while (rows.next()) { /* lock each current profile */ } }
        try (var people = connection.prepareStatement("select id from public.open_congress_entities where kind='PERSON' order by id for update");
             var rows = people.executeQuery()) { while (rows.next()) { /* lock each imported person */ } }

        var preview = CongressBulkLinkPreview.readOnlyPreview(connection);
        var byProfile = new HashMap<UUID, CongressBulkLinkPreview.Row>();
        preview.rows().forEach(row -> byProfile.put(row.politicianId(), row));
        for (Link link : approved) {
            var row = byProfile.get(link.politicianId());
            if (row == null || !link.personId().equals(row.sourceId())
                    || !("READY".equals(row.status()) || "ALREADY_LINKED".equals(row.status()))) {
                throw new HttpResponseException(409, "Approved identity match changed; refresh the dry-run preview before linking.");
            }
        }

        int linked = 0;
        int alreadyLinked = 0;
        for (Link link : approved) {
            if ("ALREADY_LINKED".equals(byProfile.get(link.politicianId()).status())) {
                alreadyLinked++;
                continue;
            }
            try (var update = connection.prepareStatement("""
                    update public.open_congress_entities set politician_id=?, linked_at=now()
                    where id=? and kind='PERSON' and politician_id is null
                    """)) {
                update.setObject(1, link.politicianId());
                update.setString(2, link.personId());
                if (update.executeUpdate() != 1) throw new SQLException("Identity link changed during the batch.");
                linked++;
            }
        }
        return new Result(approved.size(), linked, alreadyLinked);
    }
}
