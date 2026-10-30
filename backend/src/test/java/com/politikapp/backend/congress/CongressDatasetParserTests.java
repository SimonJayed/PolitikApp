package com.politikapp.backend.congress;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.util.ArrayList;
import org.junit.jupiter.api.Test;

class CongressDatasetParserTests {
    @Test
    void readsCongress20FromAnExistingLocalCloneWithoutDatabaseOrNetwork() throws Exception {
        String checkout = System.getProperty("congress.test.checkout", System.getenv("OPEN_CONGRESS_CHECKOUT"));
        assumeTrue(checkout != null && !checkout.isBlank(), "Set congress.test.checkout to verify an existing local dataset clone");
        try (var snapshot = new CongressSnapshot(checkout, CongressSnapshot.head(checkout))) {
            var parser = new CongressDatasetParser(snapshot);
            var failures = new ArrayList<String>();
            int people = 0, bills = 0, authors = 0, memberships = 0;
            for (var file : snapshot.files.values()) {
                String kind = CongressDatasetParser.kind(file);
                if (kind == null || (kind.equals("BILL") && !file.path().split("/")[3].equals("20"))) continue;
                try {
                    var parsed = parser.parse(file);
                    assertEquals(CongressDatasetParser.fileId(file), parsed.id());
                    assertTrue(parsed.flags().contains("COMMUNITY_DATASET_REQUIRES_PRIMARY_SOURCE_REVIEW"));
                    assertEquals(parsed.revision(), parser.revision(file));
                    if (kind.equals("PERSON")) people++;
                    if (kind.equals("BILL")) {
                        bills++;
                        assertEquals(20, parsed.congress());
                        assertTrue(parsed.flags().contains("ENACTMENT_NOT_INDEPENDENTLY_VERIFIED"));
                    }
                    authors += (int) parsed.relations().stream().filter(r -> r.type().equals("AUTHORED_BY") && r.targetId() != null).count();
                    memberships += (int) parsed.relations().stream().filter(r -> r.type().equals("MEMBER_OF") && r.targetId() != null).count();
                } catch (Exception e) { failures.add(file.path() + ": " + e.getMessage()); }
            }
            assertTrue(failures.isEmpty(), () -> String.join("\n", failures.subList(0, Math.min(failures.size(), 20))));
            assertTrue(people > 0 && bills > 0 && authors > 0 && memberships > 0);
            System.out.printf("Read-only dataset verification: %d people, %d Congress 20 bills, %d resolved authorships, %d memberships%n", people, bills, authors, memberships);
        }
    }
}
