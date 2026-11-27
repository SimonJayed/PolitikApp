import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.sql.Connection;
import java.sql.DriverManager;
import java.util.Properties;

/** Exports citation audit inputs from a single PostgreSQL read-only snapshot. */
public class CitationAuditSnapshot {
    public static void main(String[] args) throws Exception {
        if (args.length != 1) throw new IllegalArgumentException("Pass a new private JSON Lines output path.");
        var config = new Properties();
        try (var reader = Files.newBufferedReader(Path.of("backend/.env"))) {
            config.load(reader);
        }
        try (var connection = DriverManager.getConnection(config.getProperty("DATABASE_URL"),
                config.getProperty("DATABASE_USERNAME"), config.getProperty("DATABASE_PASSWORD"))) {
            connection.setReadOnly(true);
            connection.setTransactionIsolation(Connection.TRANSACTION_REPEATABLE_READ);
            connection.setAutoCommit(false);
            try (var statement = connection.createStatement();
                    var writer = Files.newBufferedWriter(Path.of(args[0]), StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE)) {
                statement.execute("set local statement_timeout = '90s'");
                statement.execute("set local row_security = off");
                export(connection, writer, """
                    select 'PROFILE' as type, p.politician_id as id, p.full_name as title, p.status,
                        jsonb_build_object('biography', p.biography, 'position', p.position, 'jurisdiction', p.jurisdiction,
                            'term_start', p.term_start, 'term_end', p.term_end) as facts,
                        e.id as congress_person
                    from public.politicians p
                    left join public.open_congress_entities e on e.politician_id=p.politician_id
                    """);
                export(connection, writer, """
                    select 'TIMELINE' as type, timeline_id as id, politician_id, action_identifier as category,
                        summary as title, publication_status as status, is_hidden, source_url, action_details as facts
                    from public.timeline_entries
                    """);
                export(connection, writer, """
                    select 'SUBMISSION' as type, submission_id as id, politician_id, action_identifier as category,
                        impact_summary as title, status, source_url, action_details as facts
                    from public.profile_edit_submissions
                    """);
                export(connection, writer, """
                    select 'ACCOMPLISHMENT' as type, accomplishment_id as id, politician_id, category, title,
                        visible, source_url, description, accomplishment_date, accomplishment_year
                    from public.politician_accomplishments
                    """);
                export(connection, writer, """
                    select 'CONGRESS_' || e.kind as type, e.id, e.politician_id, r.title, r.congress,
                        r.subtype, r.bill_number, r.filed_date, r.source_urls, r.payload as facts,
                        r.dataset_commit, r.dataset_path
                    from public.open_congress_entities e
                    join public.open_congress_revisions r on r.entity_id=e.id and r.revision=e.current_revision
                    where e.kind in ('PERSON', 'BILL')
                    """);
                boolean reviewsExist;
                try (var result = statement.executeQuery("select to_regclass('public.citation_reviews') is not null")) {
                    result.next();
                    reviewsExist = result.getBoolean(1);
                }
                if (reviewsExist) export(connection, writer, """
                    select 'REVIEW' as type, record_type, record_id, verification_status,
                        source_url, attribution, reviewed_at, record_updated_at
                    from public.citation_reviews
                    """);
                writer.write("{\"type\":\"SNAPSHOT_METADATA\",\"citation_reviews_present\":" + reviewsExist + "}\n");
            } finally {
                connection.rollback();
            }
        }
    }

    private static void export(Connection connection, java.io.BufferedWriter writer, String sql) throws Exception {
        try (var statement = connection.prepareStatement("select row_to_json(audit_row) from (" + sql + ") audit_row")) {
            statement.setFetchSize(1000);
            try (var result = statement.executeQuery()) {
                while (result.next()) {
                    writer.write(result.getString(1));
                    writer.newLine();
                }
            }
        }
    }
}
