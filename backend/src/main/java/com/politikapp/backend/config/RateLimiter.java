package com.politikapp.backend.config;

/**
 * Clean rate limiter interface permitting easy future migration to Redis
 * or distributed bucket-token implementations in multi-instance cloud setups.
 */
public interface RateLimiter {
    /**
     * Attempts to acquire a rate limit token for a given key.
     *
     * @param key unique identifier (e.g., client IP + endpoint category)
     * @param maxRequests maximum allowed requests within the time window
     * @param windowMillis sliding window duration in milliseconds
     * @return true if request is permitted, false if rate limited
     */
    boolean tryAcquire(String key, int maxRequests, long windowMillis);
}
