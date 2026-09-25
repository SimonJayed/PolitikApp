package com.politikapp.backend.config;

import com.politikapp.backend.auth.entity.AuthUser;
import com.politikapp.backend.auth.repository.AuthUserRepository;
import com.politikapp.backend.module1.entity.Politician;
import com.politikapp.backend.module1.entity.ProfileEditSubmission;
import com.politikapp.backend.module1.entity.TimelineEntry;
import com.politikapp.backend.module1.repository.PoliticianRepository;
import com.politikapp.backend.module1.repository.ProfileEditSubmissionRepository;
import com.politikapp.backend.module1.repository.TimelineEntryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

@Component
@Profile({"local", "supabase"})
public class LocalDatabaseSeeder implements CommandLineRunner {
    private static final Logger log = LoggerFactory.getLogger(LocalDatabaseSeeder.class);
    private final AuthUserRepository authUserRepository;
    private final PoliticianRepository politicianRepository;
    private final ProfileEditSubmissionRepository submissionRepository;
    private final TimelineEntryRepository timelineEntryRepository;
    private final PasswordEncoder passwordEncoder;

    public LocalDatabaseSeeder(
            AuthUserRepository authUserRepository,
            PoliticianRepository politicianRepository,
            ProfileEditSubmissionRepository submissionRepository,
            TimelineEntryRepository timelineEntryRepository,
            PasswordEncoder passwordEncoder
    ) {
        this.authUserRepository = authUserRepository;
        this.politicianRepository = politicianRepository;
        this.submissionRepository = submissionRepository;
        this.timelineEntryRepository = timelineEntryRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        UUID adminId = UUID.fromString("00000000-0000-0000-0000-000000000001");

        var existingAdmin = authUserRepository.findByEmailIgnoreCase("admin@politikapp.com");
        if (existingAdmin.isEmpty()) {
            AuthUser admin = new AuthUser();
            admin.setUserId(adminId);
            admin.setFullName("System Administrator");
            admin.setEmail("admin@politikapp.com");
            admin.setPasswordHash(passwordEncoder.encode("Admin123!"));
            authUserRepository.save(admin);
            log.info("Seeded default admin account (admin / Admin123!)");
        } else {
            AuthUser admin = existingAdmin.get();
            adminId = admin.getUserId();
            if (admin.getPasswordHash() == null || admin.getPasswordHash().isBlank()) {
                admin.setPasswordHash(passwordEncoder.encode("Admin123!"));
                log.info("Updated admin account with default password (Admin123!)");
            }
            authUserRepository.save(admin);
        }

        if (politicianRepository.count() > 0) {
            log.info("Politicians already populated. Skipping politician seeding.");
            return;
        }

        log.info("Seeding initial politicians...");
        Politician mayor = new Politician();
        mayor.setFullName("Vico Sotto");
        mayor.setPosition("MAYOR");
        mayor.setJurisdiction("PASIG_CITY");
        mayor.setPartyAffiliation("Independent");
        mayor.setTermStart(LocalDate.of(2022, 6, 30));
        mayor.setTermEnd(LocalDate.of(2025, 6, 30));
        mayor.setBiography("Mayor of Pasig City known for transparent public procurement, community health reforms, and civic digitalization.");
        mayor.setStatus("ACTIVE");
        mayor = politicianRepository.save(mayor);

        Politician senator = new Politician();
        senator.setFullName("Risa Hontiveros");
        senator.setPosition("SENATOR");
        senator.setJurisdiction("NATIONAL");
        senator.setPartyAffiliation("Akbayan");
        senator.setTermStart(LocalDate.of(2022, 6, 30));
        senator.setTermEnd(LocalDate.of(2028, 6, 30));
        senator.setBiography("Senator advocating for public healthcare, human rights protections, and institutional accountability.");
        senator.setStatus("ACTIVE");
        senator = politicianRepository.save(senator);

        Politician president = new Politician();
        president.setFullName("Maria Leonor Robredo");
        president.setPosition("PRESIDENT");
        president.setJurisdiction("NATIONAL");
        president.setPartyAffiliation("Liberal Party");
        president.setTermStart(LocalDate.of(2022, 6, 30));
        president.setTermEnd(LocalDate.of(2028, 6, 30));
        president.setBiography("Lawyer and public servant committed to people-centered governance, community empowerment, and ethical leadership.");
        president.setStatus("ACTIVE");
        politicianRepository.save(president);

        // 3. Seed Published Metrics & Ledger Entries
        // Mayor Metrics
        createPublishedMetric(
                mayor.getPoliticianId(),
                adminId,
                "https://pasigcity.gov.ph/infrastructure/linear-park",
                "Infrastructure",
                "PROJECT_COMPLETION",
                Map.of("projectName", "Pasig River Linear Park Revitalization", "completionPercentage", 100),
                "Completed 12km green urban linear park with eco-friendly mobility lanes."
        );

        createPublishedMetric(
                mayor.getPoliticianId(),
                adminId,
                "https://budget.pasigcity.gov.ph/scholarships-2024",
                "Finance",
                "BUDGET_ALLOCATION",
                Map.of("allocationAmount", 120_000_000),
                "Allocated municipal fund for universal public scholar subsidies."
        );

        createPublishedMetric(
                mayor.getPoliticianId(),
                adminId,
                "https://coa.gov.ph/reports/annual-audit/2023-pasig",
                "Audit",
                "COA_FINDING",
                Map.of("flaggedAmount", 1_200_000),
                "COA report noted documentation delays in emergency supply vouchers; resolved in exit conference."
        );

        // Senator Metrics
        createPublishedMetric(
                senator.getPoliticianId(),
                adminId,
                "https://legacy.senate.gov.ph/lis/bill_res.aspx?congress=19&q=SBN-1234",
                "Legislation",
                "SPONSORED_LEGISLATION",
                Map.of("legislationTitle", "Universal Healthcare Expansion Act", "legislativeStatus", "Approved"),
                "Authored legislative measure expanding PhilHealth coverage for catastrophic illnesses."
        );

        createPublishedMetric(
                senator.getPoliticianId(),
                adminId,
                "https://legacy.senate.gov.ph/lis/bill_res.aspx?congress=19&q=SBN-5678",
                "Legislation",
                "SPONSORED_LEGISLATION",
                Map.of("legislationTitle", "Mental Health in Tertiary Schools Act", "legislativeStatus", "In Committee"),
                "Sponsored bill instituting mental health clinics in state universities."
        );

        log.info("Local database successfully initialized and seeded!");
    }

    private void createPublishedMetric(
            UUID politicianId,
            UUID contributorId,
            String sourceUrl,
            String categoryTag,
            String actionIdentifier,
            Map<String, Object> actionDetails,
            String summary
    ) {
        ProfileEditSubmission submission = ProfileEditSubmission.submitted(
                politicianId,
                contributorId,
                sourceUrl,
                categoryTag,
                actionIdentifier,
                actionDetails,
                summary
        );
        submission.setStatus("PUBLISHED");
        submission = submissionRepository.save(submission);

        TimelineEntry timeline = TimelineEntry.publishedFrom(submission);
        timelineEntryRepository.save(timeline);
    }
}
