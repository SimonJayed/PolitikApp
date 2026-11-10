package com.politikapp.backend.news.service;

import com.politikapp.backend.news.entity.GovernmentSource;
import java.net.URI;
import java.util.Locale;
import java.util.Set;

/** News-source retirement does not affect stored articles or congressional datasets. */
final class GovernmentNewsSourcePolicy {
    private static final Set<String> REMOVED_HOSTS = Set.of(
            "senate.gov.ph", "legacy.senate.gov.ph", "dost.gov.ph", "da.gov.ph", "pia.gov.ph");

    private GovernmentNewsSourcePolicy() {}

    static boolean removed(GovernmentSource source) {
        try {
            String host = URI.create(source.getBaseUrl()).getHost();
            return host != null && REMOVED_HOSTS.contains(host.toLowerCase(Locale.ROOT).replaceFirst("^www\\.", ""));
        } catch (RuntimeException ignored) { return false; }
    }
}
