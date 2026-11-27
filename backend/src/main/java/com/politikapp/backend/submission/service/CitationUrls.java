package com.politikapp.backend.submission.service;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

public final class CitationUrls {
    private static final Set<String> TRACKING = Set.of("fbclid", "gclid", "dclid", "msclkid");
    private static final Set<String> SIGNATURES = Set.of("sig", "signature", "hmac", "token", "access_token");

    private CitationUrls() {}

    public static boolean isWebUrl(String value) {
        if (value == null || value.isBlank()) return false;
        try {
            URI uri = URI.create(value.trim());
            return uri.getHost() != null && uri.getUserInfo() == null
                    && ("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()));
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }

    public static String removeTracking(String value) {
        if (!isWebUrl(value)) return value;
        String url = value.trim();
        URI uri = URI.create(url);
        if (uri.getRawQuery() == null) return url;
        String[] parameters = uri.getRawQuery().split("&", -1);
        if (Arrays.stream(parameters).map(CitationUrls::key).anyMatch(name ->
                SIGNATURES.contains(name) || name.startsWith("x-amz-") || name.startsWith("x-goog-"))) {
            return url;
        }
        String query = Arrays.stream(parameters).filter(parameter -> {
            String name = key(parameter);
            return !name.startsWith("utm_") && !TRACKING.contains(name);
        }).collect(Collectors.joining("&"));
        if (query.equals(uri.getRawQuery())) return url;
        String fragment = uri.getRawFragment() == null ? "" : "#" + uri.getRawFragment();
        return url.substring(0, url.indexOf('?')) + (query.isEmpty() ? "" : "?" + query) + fragment;
    }

    private static String key(String parameter) {
        return URLDecoder.decode(parameter.split("=", 2)[0], StandardCharsets.UTF_8).toLowerCase(Locale.ROOT);
    }
}
