package com.politikapp.backend.common;

import java.util.Map;

public class HttpResponseException extends RuntimeException {
    private final int status;
    private final Map<String, String> fieldErrors;

    public HttpResponseException(int status, String message) {
        this(status, message, Map.of());
    }

    public HttpResponseException(int status, String message, Map<String, String> fieldErrors) {
        super(message);
        this.status = status;
        this.fieldErrors = fieldErrors == null ? Map.of() : fieldErrors;
    }

    public int getStatus() {
        return status;
    }

    public Map<String, String> getFieldErrors() {
        return fieldErrors;
    }
}
