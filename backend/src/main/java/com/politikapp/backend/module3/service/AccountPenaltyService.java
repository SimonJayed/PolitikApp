package com.politikapp.backend.module3.service;

import com.politikapp.backend.module3.entity.ContributorTrustProfile;
import com.politikapp.backend.module3.repository.ContributorTrustProfileRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AccountPenaltyService {
    private static final Logger log = LoggerFactory.getLogger(AccountPenaltyService.class);
    private final ContributorTrustProfileRepository contributorRepository;

    public AccountPenaltyService(ContributorTrustProfileRepository contributorRepository) {
        this.contributorRepository = contributorRepository;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public void lockContributorAccount(ContributorTrustProfile profile) {
        log.info("Locking contributor account ID={}", profile.getContributorId());
        setAccountStatusLocked(profile);
        blockFutureEditSubmissions(profile);
        contributorRepository.save(profile);
        recordPenaltyHistory(profile);
    }

    public void setAccountStatusLocked(ContributorTrustProfile profile) {
        profile.setAccountStatus("LOCKED");
    }

    public void blockFutureEditSubmissions(ContributorTrustProfile profile) {
        profile.setWritingTokenStatus("INVALIDATED");
    }

    public void recordPenaltyHistory(ContributorTrustProfile profile) {
        log.info("Penalty history recorded in SQL logs for contributor ID={}", profile.getContributorId());
    }
}
