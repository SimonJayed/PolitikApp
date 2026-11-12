package com.politikapp.backend.congress;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import java.io.InputStream;
import java.net.http.*;
import java.util.Map;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.Test;

class OriginalSourceServiceTests {
    @SuppressWarnings("unchecked")
    private HttpResponse<InputStream> response(int status, Map<String, List<String>> headers) {
        HttpResponse<InputStream> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(status);
        when(response.headers()).thenReturn(HttpHeaders.of(headers, (name, value) -> true));
        when(response.body()).thenReturn(InputStream.nullInputStream());
        return response;
    }

    @Test
    void validatesOfficialUrlsWithoutInventingOrDroppingQueryParameters() {
        var uri = OriginalSourceService.sourceUri("https://legacy.senate.gov.ph/lis/bill_res.aspx?congress=16&q=SBN-2145");
        assertNotNull(uri);
        assertEquals("congress=16&q=SBN-2145", uri.getRawQuery());
        assertTrue(OriginalSourceService.sourceUri("https://web.senate.gov.ph/lisdata/123!.pdf").toString().contains("!"));
        assertTrue(OriginalSourceService.sourceUri("https://www.congress.gov.ph/docs/a file.pdf").toString().contains("a%20file.pdf"));
        for (String invalid : new String[]{null, "", "javascript:alert(1)", "https://user@senate.gov.ph/a", "https://senate.gov.ph.evil.test/a", "http://127.0.0.1/a", "https://github.com/bettergovph/data.toml"}) assertNull(OriginalSourceService.sourceUri(invalid));
    }

    @Test
    void followsOfficialRedirectsAndCachesSuccessfulChecks() throws Exception {
        var client = mock(HttpClient.class);
        var redirect = response(302, Map.of("location", List.of("/new.pdf")));
        var ok = response(200, Map.of());
        when(client.sendAsync(any(HttpRequest.class), org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<InputStream>>any()))
                .thenReturn(CompletableFuture.completedFuture(redirect), CompletableFuture.completedFuture(ok));
        var service = new OriginalSourceService(client, uri -> true);
        assertEquals("AVAILABLE", service.check("https://www.senate.gov.ph/old.pdf").get());
        assertEquals("AVAILABLE", service.check("https://www.senate.gov.ph/old.pdf").get());
        verify(client, times(2)).sendAsync(any(), any());
    }

    @Test
    void distinguishesMissingSourcesFromUnconfirmedAccessAndRejectsExternalRedirects() throws Exception {
        for (int status : new int[]{404, 410, 403, 503}) {
            var client = mock(HttpClient.class);
            var reply = response(status, Map.of());
            when(client.sendAsync(any(HttpRequest.class), org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<InputStream>>any()))
                    .thenReturn(CompletableFuture.completedFuture(reply));
            assertEquals(status == 404 || status == 410 ? "UNAVAILABLE" : "UNCONFIRMED",
                    new OriginalSourceService(client, uri -> true).check("https://www.senate.gov.ph/doc.pdf").get());
        }
        var client = mock(HttpClient.class);
        var redirect = response(302, Map.of("location", List.of("http://127.0.0.1/private")));
        when(client.sendAsync(any(HttpRequest.class), org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<InputStream>>any()))
                .thenReturn(CompletableFuture.completedFuture(redirect));
        assertEquals("UNAVAILABLE", new OriginalSourceService(client, uri -> true).check("https://www.senate.gov.ph/doc.pdf").get());
        verify(client).sendAsync(any(), any());
    }

    @Test
    void usesSmallGetWhenHeadIsUnsupportedAndHandlesTransportFailure() throws Exception {
        var client = mock(HttpClient.class);
        var unsupported = response(405, Map.of());
        var partial = response(206, Map.of());
        when(client.sendAsync(any(HttpRequest.class), org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<InputStream>>any()))
                .thenReturn(CompletableFuture.completedFuture(unsupported),
                        CompletableFuture.completedFuture(partial),
                        CompletableFuture.failedFuture(new RuntimeException("timeout")));
        var service = new OriginalSourceService(client, uri -> true);
        assertEquals("AVAILABLE", service.check("https://www.senate.gov.ph/a.pdf").get());
        assertEquals("UNCONFIRMED", service.check("https://www.senate.gov.ph/b.pdf").get());
        verify(client).sendAsync(argThat(request -> request.method().equals("GET")
                && request.headers().firstValue("Range").orElse("").equals("bytes=0-0")), any());
    }
}
