package com.politikapp.backend.news.service;

import com.politikapp.backend.news.entity.GovernmentSource;
import java.io.IOException;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import org.apache.hc.client5.http.DnsResolver;
import org.apache.hc.client5.http.classic.methods.HttpGet;
import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.core5.util.Timeout;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** All retrieved URLs, including redirects, pass the same host and socket DNS policy. */
@Component
public class ApprovedSourceClient {
    private static final int MAX_BYTES = 5 * 1024 * 1024;
    private final Set<String> approvedHosts;

    public ApprovedSourceClient(@Value("${app.news.approved-hosts:officialgazette.gov.ph,www.officialgazette.gov.ph,www.dost.gov.ph,www.da.gov.ph,pia.gov.ph,senate.gov.ph,www.senate.gov.ph,legacy.senate.gov.ph,www.dbm.gov.ph}") String hosts) {
        approvedHosts = Arrays.stream(hosts.split(",")).map(String::trim)
                .map(s -> s.toLowerCase(Locale.ROOT)).filter(s -> !s.isBlank()).collect(Collectors.toSet());
    }

    public void validate(GovernmentSource source, URI uri) {
        String host = uri.getHost();
        String baseHost = URI.create(source.getBaseUrl()).getHost();
        if (!"https".equalsIgnoreCase(uri.getScheme()) || host == null || baseHost == null
                || uri.getUserInfo() != null || (uri.getPort() != -1 && uri.getPort() != 443)
                || !approvedHosts.contains(host.toLowerCase(Locale.ROOT))
                || !(host.replaceFirst("^www\\.", "").equalsIgnoreCase(baseHost.replaceFirst("^www\\.", ""))
                    || (baseHost.endsWith("senate.gov.ph") && Set.of("senate.gov.ph", "www.senate.gov.ph", "legacy.senate.gov.ph")
                        .contains(host.toLowerCase(Locale.ROOT))))) {
            throw new IllegalArgumentException("URL must use HTTPS on an explicitly approved source host.");
        }
    }

    public Download get(GovernmentSource source, URI initial) throws IOException {
        var manager = PoolingHttpClientConnectionManagerBuilder.create().setDnsResolver(new DnsResolver() {
            @Override
            public InetAddress[] resolve(String host) throws UnknownHostException {
                InetAddress[] addresses = InetAddress.getAllByName(host);
                for (InetAddress address : addresses) {
                    byte[] bytes = address.getAddress();
                    int first = bytes[0] & 255;
                    int second = bytes.length > 1 ? bytes[1] & 255 : 0;
                    boolean reserved = bytes.length == 4
                            ? first == 0 || first >= 224 || (first == 100 && second >= 64 && second <= 127)
                              || (first == 192 && second == 0) || (first == 198 && (second == 18 || second == 19))
                            : (first & 0xe0) != 0x20; // Only global unicast IPv6.
                    if (reserved || address.isAnyLocalAddress() || address.isLoopbackAddress()
                            || address.isLinkLocalAddress() || address.isSiteLocalAddress() || address.isMulticastAddress()) {
                        throw new UnknownHostException("Source resolves to a non-public address.");
                    }
                }
                return addresses;
            }

            @Override
            public String resolveCanonicalHostname(String host) throws UnknownHostException {
                resolve(host);
                return host;
            }
        }).build();
        var config = RequestConfig.custom().setConnectTimeout(Timeout.ofSeconds(8))
                .setConnectionRequestTimeout(Timeout.ofSeconds(8)).setResponseTimeout(Timeout.ofSeconds(15)).build();
        try (var client = HttpClients.custom().setConnectionManager(manager).setDefaultRequestConfig(config)
                .disableRedirectHandling().disableAutomaticRetries().disableContentCompression().build()) {
            URI uri = initial;
            for (int hop = 0; hop <= 3; hop++) {
                validate(source, uri);
                var request = new HttpGet(uri);
                URI requestedUri = uri;
                request.setHeader("User-Agent", "PolitikApp/1.0");
                request.setHeader("Accept-Encoding", "identity");
                Download result = client.execute(request, response -> {
                    int status = response.getCode();
                    if (status >= 300 && status < 400) {
                        var location = response.getFirstHeader("Location");
                        if (location == null) throw new IOException("Redirect has no location.");
                        return new Download(null, location.getValue(), null);
                    }
                    if (status != 200) throw new HttpStatusException(status, requestedUri);
                    if (response.getEntity() == null) throw new IOException("Empty response from " + requestedUri);
                    if (response.getEntity().getContentLength() > MAX_BYTES) throw new IOException("Source exceeds 5 MB limit.");
                    try (var input = response.getEntity().getContent()) {
                        byte[] bytes = input.readNBytes(MAX_BYTES + 1);
                        if (bytes.length > MAX_BYTES) throw new IOException("Source exceeds 5 MB limit.");
                        return new Download(bytes, response.getEntity().getContentType(), null);
                    }
                });
                if (result.bytes() != null) return new Download(result.bytes(), result.contentType(), uri);
                uri = uri.resolve(result.contentType());
            }
            throw new IOException("Source exceeded redirect limit.");
        }
    }

    public record Download(byte[] bytes, String contentType, URI uri) {}

    public static final class HttpStatusException extends IOException {
        private final int status;
        private final URI uri;

        public HttpStatusException(int status, URI uri) {
            super("HTTP " + status + " at " + uri);
            this.status = status;
            this.uri = uri;
        }

        public int status() { return status; }
        public URI uri() { return uri; }
        public boolean blocked() { return status == 401 || status == 403 || status == 429 || status == 451; }
    }
}
