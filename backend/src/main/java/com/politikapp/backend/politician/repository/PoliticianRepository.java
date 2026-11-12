package com.politikapp.backend.politician.repository;

import com.politikapp.backend.politician.entity.Politician;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface PoliticianRepository extends JpaRepository<Politician, UUID> {
    @Query("""
            select p from Politician p
            where (p.status is null or p.status <> 'ARCHIVED') and (
                exists (select s.submissionId from ProfileEditSubmission s
                    where s.politicianId=p.politicianId and s.status='PUBLISHED'
                    and s.actionIdentifier in ('SPONSORED_LEGISLATION','PROJECT_COMPLETION','BUDGET_ALLOCATION','COA_FINDING'))
                or exists (select t.timelineId from TimelineEntry t
                    where t.politicianId=p.politicianId and t.publicationStatus='PUBLISHED' and t.isHidden=false
                    and t.actionIdentifier in ('SPONSORED_LEGISLATION','PROJECT_COMPLETION','BUDGET_ALLOCATION','COA_FINDING'))
            )
            """)
    List<Politician> findWgiCandidates();

    @Query("select count(p) from Politician p where p.status is null or p.status <> 'ARCHIVED'")
    long countPublicProfiles();

    List<Politician> findAllByOrderByFullNameAsc();

    List<Politician> findByFullNameContainingIgnoreCaseOrderByFullNameAsc(String fullName);

    Optional<Politician> findByFullName(String fullName);
}
