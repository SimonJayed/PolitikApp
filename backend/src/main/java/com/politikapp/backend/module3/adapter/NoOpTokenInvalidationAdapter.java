package com.politikapp.backend.module3.adapter;

import com.politikapp.backend.module3.port.TokenInvalidationPort;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class NoOpTokenInvalidationAdapter implements TokenInvalidationPort {
    @Override
    public void invalidateActiveUserJsonWebTokens(UUID contributorId) {
        // JWT invalidation belongs to the integration branch.
    }
}
