package com.politikapp.backend.news.service;

import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.news.dto.NewsDtos.FetchResultResponse;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.springframework.stereotype.Service;

/** A single bounded worker keeps source retrieval off HTTP request threads. */
@Service
public class NewsRetrievalJob {
    private final GovernmentNewsRetrievalService retrieval;
    private final ExecutorService worker = Executors.newSingleThreadExecutor(r -> {
        Thread thread = new Thread(r, "government-source-retrieval");
        thread.setDaemon(true);
        return thread;
    });
    private volatile Status status = new Status("IDLE", null, null);

    public NewsRetrievalJob(GovernmentNewsRetrievalService retrieval) { this.retrieval = retrieval; }

    public synchronized Status start() {
        if ("RUNNING".equals(status.state())) throw new HttpResponseException(409, "Retrieval is already running.");
        status = new Status("RUNNING", null, null);
        worker.submit(() -> {
            try { status = new Status("COMPLETED", retrieval.fetchLatest(), null); }
            catch (HttpResponseException failure) { status = new Status("FAILED", null, failure.getMessage()); }
            catch (Exception failure) { status = new Status("FAILED", null, "Retrieval failed. Check source configuration and server availability."); }
        });
        return status;
    }

    public Status status() { return status; }

    @jakarta.annotation.PreDestroy
    public void close() { worker.shutdownNow(); }

    public record Status(String state, FetchResultResponse result, String message) {}
}
