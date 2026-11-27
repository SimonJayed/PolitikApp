package com.politikapp.backend.verification;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.junit.jupiter.api.Test;

class CitationMigrationTests {
    @Test
    void citationMigrationHasItsOwnVersionAndRequiresItsLocation() {
        assertThat(resolve("classpath:db/migration")).contains("28").doesNotContain("29");
        assertThat(resolve("classpath:db/migration", "classpath:db/citation-migration"))
                .containsOnlyOnce("28", "29");
    }

    private static String[] resolve(String... locations) {
        var flyway = Flyway.configure()
                .dataSource("jdbc:h2:mem:" + UUID.randomUUID(), "sa", "")
                .locations(locations)
                .load();
        return Arrays.stream(flyway.info().all())
                .map(MigrationInfo::getVersion)
                .map(Object::toString)
                .toArray(String[]::new);
    }
}
