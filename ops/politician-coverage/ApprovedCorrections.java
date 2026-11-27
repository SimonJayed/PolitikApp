import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.HexFormat;
import java.util.Properties;

/** Runs the approved additive profile and accountability batch. Does not invoke Flyway. */
public class ApprovedCorrections {
    private static final Path OPS = Path.of("ops/politician-coverage");
    private static final String STATE = """
        select jsonb_build_object(
            'existing_profiles', (select md5(string_agg(to_jsonb(p)::text, '' order by p.politician_id))
                from public.politicians p where not exists(select 1 from new_secretaries n where n.id=p.politician_id)),
            'other_timeline', (select md5(string_agg(to_jsonb(t)::text, '' order by t.timeline_id))
                from public.timeline_entries t where not exists(select 1 from record_changes c where c.timeline_id=t.timeline_id)),
            'other_submissions', (select md5(string_agg(to_jsonb(s)::text, '' order by s.submission_id))
                from public.profile_edit_submissions s where not exists(select 1 from record_changes c where c.submission_id=s.submission_id)),
            'congress_links', (select md5(string_agg(to_jsonb(e)::text, '' order by e.id))
                from public.open_congress_entities e where e.kind='PERSON'),
            'flyway', (select jsonb_agg(to_jsonb(f) order by f.installed_rank) from public.flyway_schema_history f)
        )
        """;

    public static void main(String[] args) throws Exception {
        if (args.length != 5 || !("preflight".equals(args[0]) || "apply".equals(args[0]))) {
            throw new IllegalArgumentException("Use <preflight|apply> <manifest> <sha256> <new-backup> <new-result>.");
        }
        byte[] manifest = Files.readAllBytes(Path.of(args[1]));
        String digest = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(manifest));
        if (!digest.equals(args[2])) throw new IllegalArgumentException("Manifest digest changed.");
        boolean apply = "apply".equals(args[0]);
        if (Files.exists(Path.of(args[3])) || Files.exists(Path.of(args[4]))) {
            throw new IllegalArgumentException("Use new backup and result paths.");
        }

        var config = new Properties();
        try (var reader = Files.newBufferedReader(Path.of("backend/.env"))) {
            config.load(reader);
        }
        try (var connection = DriverManager.getConnection(config.getProperty("DATABASE_URL"),
                config.getProperty("DATABASE_USERNAME"), config.getProperty("DATABASE_PASSWORD"))) {
            connection.setAutoCommit(false);
            try {
                execute(connection, "set local lock_timeout='5s'; set local statement_timeout='35s'; set local row_security=off");
                if (apply) execute(connection, """
                    lock table public.politicians, public.timeline_entries, public.profile_edit_submissions,
                        public.open_congress_entities, public.politician_accomplishments in share row exclusive mode
                    """);
                try (var statement = connection.prepareStatement(read("stage"))) {
                    String input = new String(manifest, StandardCharsets.UTF_8);
                    statement.setString(1, input);
                    statement.setString(2, input);
                    statement.execute();
                }
                execute(connection, read("preflight"));
                var before = scalar(connection, STATE);
                archive(connection, Path.of(args[3]));
                if (apply) {
                    execute(connection, read("apply"));
                    if (!before.equals(scalar(connection, STATE))) {
                        throw new IllegalStateException("Out-of-scope row fingerprints changed.");
                    }
                }
                archive(connection, Path.of(args[4]));
                if (apply) connection.commit();
                else connection.rollback();
                System.out.println((apply ? "Committed" : "Preflight rolled back") + ". Manifest SHA-256 " + digest);
            } catch (SQLException | RuntimeException | java.io.IOException error) {
                connection.rollback();
                throw error;
            }
        }
    }

    private static String read(String action) throws Exception {
        return Files.readString(OPS.resolve("approved-corrections-" + action + ".sql"));
    }

    private static void execute(Connection connection, String sql) throws SQLException {
        try (var statement = connection.createStatement()) { statement.execute(sql); }
    }

    private static String scalar(Connection connection, String sql) throws SQLException {
        try (var statement = connection.createStatement(); var result = statement.executeQuery(sql)) {
            if (!result.next()) throw new SQLException("Missing expected query result.");
            return result.getString(1);
        }
    }

    private static void archive(Connection connection, Path output) throws SQLException, java.io.IOException {
        var snapshot = scalar(connection, """
            select jsonb_pretty(jsonb_build_object(
                'recorded_at', clock_timestamp(),
                'profile_count', (select count(*) from public.politicians),
                'new_profile_ids', (select jsonb_agg(id order by id) from new_secretaries),
                'profiles', (select coalesce(jsonb_agg(to_jsonb(p) order by p.politician_id), '[]')
                    from public.politicians p join new_secretaries n on n.id=p.politician_id),
                'timeline_entries', (select jsonb_agg(to_jsonb(t) order by t.timeline_id)
                    from public.timeline_entries t join record_changes c using(timeline_id)),
                'submissions', (select jsonb_agg(to_jsonb(s) order by s.submission_id)
                    from public.profile_edit_submissions s join record_changes c using(submission_id)),
                'fingerprints', (
            """ + STATE + ")))") + "\n";
        try (var file = FileChannel.open(output, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE)) {
            var buffer = ByteBuffer.wrap(snapshot.getBytes(StandardCharsets.UTF_8));
            while (buffer.hasRemaining()) file.write(buffer);
            file.force(true);
        }
    }
}
