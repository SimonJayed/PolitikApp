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

/** Runs the coverage preflight or the explicitly approved transaction using the PostgreSQL JDBC driver. */
public class PoliticianCoverage {
    private static final Path OPS = Path.of("ops/politician-coverage");

    public static void main(String[] args) throws Exception {
        boolean congressOnly = args.length == 4 && "--congress-only".equals(args[3]);
        boolean mayorsOnly = args.length == 4 && "--mayors-only".equals(args[3]);
        boolean validLength = args.length == 3 || congressOnly || mayorsOnly;
        boolean apply = validLength && "apply".equals(args[0]) && args[1].matches("[0-9a-f]{64}");
        boolean report = validLength && "report".equals(args[0]);
        if (!apply && !report) {
            throw new IllegalArgumentException("Use report <report.json> <backup.json> or apply <approved report SHA-256> <backup.json>, with optional --congress-only or --mayors-only.");
        }

        var config = new Properties();
        try (var reader = Files.newBufferedReader(Path.of("backend/.env"))) {
            config.load(reader);
        }
        var plan = read("plan.sql");
        var roster = congressOnly || mayorsOnly ? "[]" : read("executive-roster.json");
        var history = mayorsOnly ? "[]" : read("historical-executives.json");

        try (var connection = DriverManager.getConnection(config.getProperty("DATABASE_URL"),
                config.getProperty("DATABASE_USERNAME"), config.getProperty("DATABASE_PASSWORD"))) {
            connection.setReadOnly(report);
            connection.setAutoCommit(false);
            try {
                execute(connection, report
                        ? "set transaction isolation level repeatable read, read only"
                        : "set transaction isolation level repeatable read");
                execute(connection, "set local lock_timeout = '5s'");
                execute(connection, "set local statement_timeout = '45s'");
                execute(connection, "set local row_security = off");
                if (congressOnly) execute(connection, "set local politikapp.congress_only = 'on'");
                if (mayorsOnly) execute(connection, "set local politikapp.mayors_only = 'on'");
                if (apply) {
                    execute(connection, """
                        lock table public.politicians, public.open_congress_entities, public.open_congress_revisions,
                            public.open_congress_relationships, public.profile_edit_submissions, public.timeline_entries,
                            public.moderation_queue, public.curation_audit_events, public.politician_accomplishments,
                            public.news_politicians, public.saved_posts
                        in share row exclusive mode
                        """);
                }

                var reportJson = scalar(connection, plan + read("report.sql"), roster, history) + "\n";
                var digest = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                        .digest(reportJson.getBytes(StandardCharsets.UTF_8)));
                if (apply && !args[1].equals(digest)) {
                    throw new IllegalStateException("The current report differs from the approved snapshot. Generate a new report for review.");
                }

                var archive = scalar(connection, plan + """
                        select jsonb_pretty(jsonb_build_object(
                            'rows_before', (select data from backup),
                            'new_executive_ids', (select jsonb_agg(id order by id) from roster where profile_id is null),
                            'deletion_ids', (select jsonb_agg(politician_id order by politician_id) from candidates)))
                        """, roster, history);
                writeNew(Path.of(args[2]), archive + "\n");

                if (report) {
                    writeNew(Path.of(args[1]), reportJson);
                    connection.rollback();
                } else {
                    if (!"0".equals(scalar(connection, plan + "select count(*) from blockers", roster, history))) {
                        throw new IllegalStateException("The coverage report has unresolved blockers.");
                    }
                    boundExecute(connection, "create temp table coverage_candidates on commit drop as " + plan
                            + "select politician_id from candidates", roster, history);
                    boundExecute(connection, "create temp table coverage_roster on commit drop as " + plan
                            + "select * from roster", roster, history);
                    execute(connection, read("apply.sql"));
                    if ((congressOnly || mayorsOnly)
                            && !"0".equals(scalar(connection, plan + "select count(*) from candidates", roster, history))) {
                        throw new IllegalStateException("At least one deletion candidate remains after the transaction.");
                    }
                    connection.commit();
                }

                System.out.println("Report SHA-256 " + digest);
            } catch (Exception error) {
                connection.rollback();
                throw error;
            }
        }
    }

    private static String read(String file) throws Exception {
        return Files.readString(OPS.resolve(file));
    }

    private static void writeNew(Path file, String contents) throws Exception {
        Files.writeString(file, contents, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE);
    }

    private static void execute(Connection connection, String sql) throws SQLException {
        try (var statement = connection.createStatement()) {
            statement.execute(sql);
        }
    }

    private static void boundExecute(Connection connection, String sql, String roster, String history) throws SQLException {
        try (var statement = connection.prepareStatement(sql)) {
            statement.setString(1, roster);
            statement.setString(2, history);
            statement.execute();
        }
    }

    private static String scalar(Connection connection, String sql, String roster, String history) throws SQLException {
        try (var statement = connection.prepareStatement(sql)) {
            statement.setString(1, roster);
            statement.setString(2, history);
            try (var rows = statement.executeQuery()) {
                if (!rows.next()) throw new SQLException("Coverage query returned no data.");
                return rows.getString(1);
            }
        }
    }
}
