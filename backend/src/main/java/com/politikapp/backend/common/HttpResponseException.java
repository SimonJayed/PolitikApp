package com.politikapp.backend.common;

public class HttpResponseException extends RuntimeException {
    private final int status;

    public HttpResponseException(int status, String message) {
        super(message);
        this.status = status;
    }

    public int getStatus() {
        return status;
    }
}
