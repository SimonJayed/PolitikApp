package com.politikapp.backend.module3.port;

import java.util.UUID;

public interface TokenInvalidationPort {
    void invalidateActiveUserJsonWebTokens(UUID contributorId);
}
