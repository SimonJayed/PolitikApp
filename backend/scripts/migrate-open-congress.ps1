
param(
    [switch]$Apply,
    [string]$MavenRepository = (Join-Path $env:USERPROFILE '.m2/repository')
)

$ErrorActionPreference = 'Stop'

# Default: read-only preflight.
# -Apply executes V25 only after prerequisite checks pass.

$backendRoot = Split-Path $PSScriptRoot -Parent
$repository = $MavenRepository

$jars = @(
    'org/flywaydb/flyway-core/11.7.2/flyway-core-11.7.2.jar',
    'org/flywaydb/flyway-database-postgresql/11.7.2/flyway-database-postgresql-11.7.2.jar',
    'org/postgresql/postgresql/42.7.10/postgresql-42.7.10.jar'
) | ForEach-Object { Join-Path $repository $_ }

$jacksonPath = Join-Path $repository 'com/fasterxml/jackson'

if (!(Test-Path -LiteralPath $jacksonPath)) {
    throw 'Jackson dependencies are missing.'
}

$jars += @(
    Get-ChildItem $jacksonPath -Recurse -Filter '*2.15.2.jar' |
        Select-Object -ExpandProperty FullName
)

foreach ($jar in $jars) {
    if (!(Test-Path -LiteralPath $jar)) {
        throw "Required local dependency is missing: $jar"
    }
}

$classpath = $jars -join ';'

$source = @'
import java.nio.file.*;
import java.util.*;
import java.sql.*;
import org.flywaydb.core.Flyway;
import org.postgresql.ds.PGSimpleDataSource;

class CongressMigration {

    static List<String> history(PGSimpleDataSource ds) throws Exception {
        List<String> rows = new ArrayList<>();

        try (
            var c = ds.getConnection();
            var s = c.createStatement();
            var r = s.executeQuery(
                "select row_to_json(h)::text " +
                "from public.flyway_schema_history h " +
                "order by installed_rank"
            )
        ) {
            while (r.next()) {
                rows.add(r.getString(1));
            }
        }

        return rows;
    }

    static void run(boolean apply) throws Exception {

        Path root = Path.of(".").toAbsolutePath().normalize();

        Properties env = new Properties();

        try (var reader = Files.newBufferedReader(root.resolve(".env"))) {
            env.load(reader);
        }

        var ds = new PGSimpleDataSource();

        ds.setURL(env.getProperty("DATABASE_URL"));
        ds.setUser(env.getProperty("DATABASE_USERNAME"));
        ds.setPassword(env.getProperty("DATABASE_PASSWORD"));

        ds.setReadOnly(true);
        ds.setOptions(
            "-c default_transaction_read_only=on " +
            "-c statement_timeout=30000"
        );

        List<String> before = history(ds);

        String active = "filesystem:" +
            root.resolve("src/main/resources/db/migration")
                .toString().replace('\\', '/');

        String pending = "filesystem:" +
            root.resolve("src/main/resources/db/pending")
                .toString().replace('\\', '/');

        var flyway = Flyway.configure()
            .dataSource(ds)
            .locations(active, pending)
            .defaultSchema("public")
            .schemas("public")
            .table("flyway_schema_history")
            .target("25")
            .ignoreMigrationPatterns("*:pending")
            .cleanDisabled(true)
            .validateMigrationNaming(true)
            .load();

        Set<String> deleted = new HashSet<>();
        int pendingCount = 0;
        boolean v24 = false;
        boolean v25 = false;

        for (var m : flyway.info().all()) {

            String state = m.getState().name();
            String v = m.getVersion() == null
                ? ""
                : m.getVersion().toString();

            System.out.println("STATE " + v + " " + state);

            if (state.equals("DELETED")) {
                deleted.add(v);
            } else if (
                state.equals("PENDING") &&
                v.equals("25") &&
                m.getScript().equals(
                    "V25__add_open_congress_dataset.sql"
                )
            ) {
                pendingCount++;
            } else if (
                !Set.of(
                    "SUCCESS",
                    "BASELINE",
                    "BASELINE_IGNORED"
                ).contains(state)
            ) {
                throw new Exception(
                    "Unexpected migration state: " + v + " " + state
                );
            }

            if (v.equals("24") && state.equals("SUCCESS")) {
                v24 = true;
            }
            if (v.equals("25") && state.equals("SUCCESS")) {
                v25 = true;
            }

            if (
                m.getVersion() != null &&
                m.getVersion().compareTo(
                    org.flywaydb.core.api.MigrationVersion
                        .fromVersion("25")
                ) > 0
            ) {
                throw new Exception(
                    "Newer migration requires review"
                );
            }
        }

        if (
            !deleted.equals(Set.of("11", "23")) ||
            pendingCount != (v25 ? 0 : 1) ||
            !v24
        ) {
            throw new Exception(
                "Migration prerequisites changed"
            );
        }

        flyway.validate();

        if (v25) {
            try (var c = ds.getConnection(); var s = c.createStatement();
                 var r = s.executeQuery("select to_regclass('public.open_congress_entities'), " +
                     "to_regclass('public.open_congress_revisions'), to_regclass('public.open_congress_relationships')")) {
                r.next();
                for (int i = 1; i <= 3; i++) {
                    if (r.getObject(i) == null) throw new Exception("Applied V25 schema is incomplete");
                }
            }
            try (var c = ds.getConnection(); var s = c.createStatement();
                 var r = s.executeQuery("select kind, count(*), count(current_revision), count(politician_id) from public.open_congress_entities group by kind order by kind")) {
                boolean empty = true;
                while (r.next()) {
                    empty = false;
                    System.out.println("RECORDS " + r.getString(1) + "=" + r.getLong(2) + " CURRENT=" + r.getLong(3) + " LINKED=" + r.getLong(4));
                }
                if (empty) System.out.println("RECORDS empty: no Congress dataset records have been imported.");
            }
            try (var c = ds.getConnection(); var s = c.createStatement();
                 var r = s.executeQuery("select relationship, count(*) from public.open_congress_relationships group by relationship order by relationship")) {
                while (r.next()) System.out.println("RELATIONSHIPS " + r.getString(1) + "=" + r.getLong(2));
            }
            try (var c = ds.getConnection(); var s = c.createStatement();
                 var r = s.executeQuery("select " +
                     "(select count(*) from public.politicians), " +
                     "(select count(*) from public.timeline_entries where publication_status='PUBLISHED' and not is_hidden), " +
                     "(select count(*) from public.news_articles where status='PUBLISHED'), " +
                     "(select count(*) from public.news_articles where status='PENDING_REVIEW')")) {
                r.next();
                System.out.println("MVP CONTENT politicians=" + r.getLong(1) +
                    " published_timelines=" + r.getLong(2) +
                    " published_news=" + r.getLong(3) +
                    " pending_news=" + r.getLong(4));
            }
            try (var c = ds.getConnection(); var s = c.createStatement();
                 var r = s.executeQuery("select count(distinct e.id) from public.open_congress_entities e " +
                     "join public.open_congress_revisions r on r.entity_id=e.id and r.revision=e.current_revision " +
                     "join public.politicians p on lower(regexp_replace(r.title, '[^[:alnum:]]+', ' ', 'g')) = " +
                     "lower(regexp_replace(p.full_name, '[^[:alnum:]]+', ' ', 'g')) " +
                     "where e.kind='PERSON' and e.politician_id is null")) {
                r.next();
                System.out.println("UNLINKED EXACT-NAME CANDIDATES=" + r.getLong(1));
            }
            if (apply) throw new Exception("V25 is already applied; no migration is required");
            System.out.println("PREFLIGHT PASS: V11/V23 deleted; V24/V25 successful. Existing checksums validated. No writes performed.");
            return;
        }

        if (!Files.isRegularFile(root.resolve("src/main/resources/db/pending/V25__add_open_congress_dataset.sql")) ||
            Files.exists(root.resolve("src/main/resources/db/migration/V25__add_open_congress_dataset.sql"))) {
            throw new Exception("Unapplied V25 must be in the pending directory only; inspect before restarting");
        }

        try (
            var c = ds.getConnection();
            var s = c.createStatement();
            var r = s.executeQuery(
                "select " +
                "to_regclass('public.open_congress_entities'), " +
                "to_regclass('public.open_congress_revisions'), " +
                "to_regclass('public.open_congress_relationships')"
            )
        ) {
            r.next();

            for (int i = 1; i <= 3; i++) {
                if (r.getObject(i) != null) {
                    throw new Exception(
                        "Congress objects already exist; review required"
                    );
                }
            }
        }

        System.out.println(
            "PREFLIGHT PASS: V11/V23 deleted; " +
            "V24 successful; only V25 pending. " +
            "Existing checksums validated."
        );

        if (!apply) {
            return;
        }

        if (!history(ds).equals(before)) {
            throw new Exception(
                "History changed during preflight"
            );
        }

        ds.setReadOnly(false);
        ds.setOptions(
            "-c statement_timeout=60000 " +
            "-c lock_timeout=10000"
        );

        var result = flyway.migrate();

        ds.setReadOnly(true);
        ds.setOptions(
            "-c default_transaction_read_only=on " +
            "-c statement_timeout=30000"
        );

        List<String> after = history(ds);

        if (
            result.migrationsExecuted != 1 ||
            after.size() != before.size() + 1 ||
            !after.subList(0, before.size()).equals(before)
        ) {
            throw new Exception(
                "Unexpected post-migration history; inspect before retrying"
            );
        }

        var last = new com.fasterxml.jackson.databind.ObjectMapper()
            .readTree(after.get(after.size() - 1));

        if (
            !last.path("version").asText().equals("25") ||
            !last.path("success").asBoolean()
        ) {
            throw new Exception(
                "V25 success not confirmed"
            );
        }

        System.out.println(
            "MIGRATION PASS: V25 applied; " +
            "all earlier history rows unchanged. " +
            "No dataset import performed."
        );
    }
}

try {
    CongressMigration.run(false);
} catch (Exception e) {
    System.out.println(
        "OPERATION FAILED: " +
        e.getClass().getSimpleName() +
        (e instanceof SQLException
            ? " SQLSTATE=" + ((SQLException)e).getSQLState()
            : " (inspect migration prerequisites; credentials suppressed)")
    );
}
/exit
'@

if ($Apply) {
    $source = $source.Replace(
        'CongressMigration.run(false)',
        'CongressMigration.run(true)'
    )
}

Push-Location $backendRoot

try {
    $result = @(
        $source | & jshell --execution local `
            '-J--add-modules=java.sql' `
            --class-path $classpath -
    )

    $result | Write-Output

    $output = $result -join "`n"

    if (
        $LASTEXITCODE -ne 0 -or
        $output -match 'Error:|Exception|OPERATION FAILED' -or
        $output -notmatch 'PREFLIGHT PASS'
    ) {
        throw 'Preflight or migration failed. Do not retry blindly.'
    }

    if ($Apply) {

        if ($output -notmatch 'MIGRATION PASS') {
            throw 'Migration not confirmed. Inspect history before retrying.'
        }

        $pendingFile = Join-Path $backendRoot `
            'src/main/resources/db/pending/V25__add_open_congress_dataset.sql'

        $activeFile = Join-Path $backendRoot `
            'src/main/resources/db/migration/V25__add_open_congress_dataset.sql'

        if (!(Test-Path -LiteralPath $pendingFile)) {
            throw 'Pending V25 migration file is missing.'
        }

        if (Test-Path -LiteralPath $activeFile) {
            throw 'V25 already exists in the active migration directory.'
        }

        Move-Item -LiteralPath $pendingFile `
            -Destination $activeFile `
            -ErrorAction Stop

        Write-Output (
            'V25 moved to the active migration directory ' +
            'for subsequent backend validation.'
        )
    }
}
finally {
    Pop-Location
}
