package com.politikapp.backend.reputation.port;

import java.util.UUID;

public interface TokenInvalidationPort {
    void invalidateActiveUserJsonWebTokens(UUID contributorId);
}
