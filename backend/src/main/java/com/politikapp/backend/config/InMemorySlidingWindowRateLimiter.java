package com.politikapp.backend.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Thread-safe sliding window in-memory rate limiter with a periodic cleanup daemon.
 * Avoids memory leaks by purging stale timestamps and removing dead keys older than 5 minutes.
 */
@Component
public class InMemorySlidingWindowRateLimiter implements RateLimiter {

    private static final Logger log = LoggerFactory.getLogger(InMemorySlidingWindowRateLimiter.class);

    private final Map<String, Deque<Long>> requestLogs = new ConcurrentHashMap<>();

    @Override
    public boolean tryAcquire(String key, int maxRequests, long windowMillis) {
        long now = System.currentTimeMillis();
        long windowStart = now - windowMillis;

        Deque<Long> timestamps = requestLogs.computeIfAbsent(key, k -> new ArrayDeque<>());

        synchronized (timestamps) {
            // Evict timestamps older than the sliding window
            while (!timestamps.isEmpty() && timestamps.peekFirst() < windowStart) {
                timestamps.pollFirst();
            }

            if (timestamps.size() >= maxRequests) {
                return false;
            }

            timestamps.addLast(now);
            return true;
        }
    }

    /**
     * Periodic cleanup daemon running every 5 minutes (300,000 ms).
     * Cleans up all entries with timestamps older than 5 minutes and removes empty keys.
     */
    @Scheduled(fixedDelay = 300_000, initialDelay = 300_000)
    public void purgeStaleEntries() {
        long now = System.currentTimeMillis();
        long fiveMinutesAgo = now - 300_000;
        int purgedKeys = 0;

        for (Iterator<Map.Entry<String, Deque<Long>>> it = requestLogs.entrySet().iterator(); it.hasNext(); ) {
            Map.Entry<String, Deque<Long>> entry = it.next();
            Deque<Long> timestamps = entry.getValue();

            synchronized (timestamps) {
                while (!timestamps.isEmpty() && timestamps.peekFirst() < fiveMinutesAgo) {
                    timestamps.pollFirst();
                }
                if (timestamps.isEmpty()) {
                    it.remove();
                    purgedKeys++;
                }
            }
        }

        if (purgedKeys > 0) {
            log.debug("RateLimiter cleanup daemon purged {} idle keys", purgedKeys);
        }
    }

    /**
     * Resets all tracked rate limiting data (useful for testing).
     */
    public void clear() {
        requestLogs.clear();
    }

    public int getTrackedKeyCount() {
        return requestLogs.size();
    }
}
