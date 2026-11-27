package com.politikapp.backend.congress;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

final class LegislativeAccountability {
    private LegislativeAccountability() {}

    enum Kind { ATTENDANCE, VOTE, COMMITTEE }
    enum Chamber {
        SENATE("senate.gov.ph", "Senate of the Philippines"),
        HOUSE("congress.gov.ph", "House of Representatives");

        final String domain;
        final String organization;

        Chamber(String domain, String organization) {
            this.domain = domain;
            this.organization = organization;
        }
    }
    enum Decision {
        PRESENT, ABSENT, EXCUSED, UNAVAILABLE, YES, NO, ABSTAINED, UNKNOWN, CHAIR, VICE_CHAIR, MEMBER
    }
    enum Verification { VERIFIED, PENDING_VERIFICATION, UNVERIFIED, INVALID_SOURCE }

    record Input(@NotNull Kind kind, @NotNull Chamber chamber, @NotNull @Min(8) @Max(200) Integer congress,
                 @NotNull Decision decision, @Size(max = 300) String title, @Size(max = 150) String reference,
                 LocalDate eventDate, LocalDate endDate, @Size(max = 2048) String sourceUrl,
                 @NotNull Verification verificationStatus, @Size(max = 5000) String verificationNotes,
                 @PositiveOrZero Long revision) {}

    record Entry(UUID recordId, Kind kind, Chamber chamber, int congress, Decision decision, String title,
                 String reference, LocalDate eventDate, LocalDate endDate, String sourceUrl,
                 String sourceOrganization, Verification verificationStatus, Instant reviewedAt) {}

    record AdminEntry(Entry record, String verificationNotes, UUID reviewedBy, Instant withdrawnAt, long revision) {}

    record Attendance(int congress, Chamber chamber, long present, long absent, long excused, long unavailable,
                      Double percentage) {}

    record Page<T>(boolean available, List<T> records, List<Attendance> attendance, int offset, boolean hasMore) {}

    record Filter(Kind kind, Chamber chamber, Integer congress, int offset, int limit) {}
}
