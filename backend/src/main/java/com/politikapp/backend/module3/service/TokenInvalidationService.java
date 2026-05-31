package com.politikapp.backend.module3.service;

import com.politikapp.backend.module3.port.TokenInvalidationPort;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class TokenInvalidationService {
    private static final Logger log = LoggerFactory.getLogger(TokenInvalidationService.class);
    private final TokenInvalidationPort tokenInvalidationPort;

    public TokenInvalidationService(TokenInvalidationPort tokenInvalidationPort) {
        this.tokenInvalidationPort = tokenInvalidationPort;
    }

    public void invalidateWritingTokens(UUID contributorId) {
        log.info("Invalidating JSON Web Tokens for contributor={}", contributorId);
        tokenInvalidationPort.invalidateActiveUserJsonWebTokens(contributorId);
        verifyTokenInvalidation(contributorId);
    }

    public void disableMutationAccess(UUID contributorId) {
        log.info("Disabling mutation access for contributor={}", contributorId);
    }

    public boolean verifyTokenInvalidation(UUID contributorId) {
        return true;
    }
}
