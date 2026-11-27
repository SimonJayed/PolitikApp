package com.politikapp.backend.verification;

import com.politikapp.backend.auth.security.AuthPrincipal;
import com.politikapp.backend.common.HttpResponseException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
class CitationReviewController {
    private final CitationReviewService reviews;
    private final boolean enabled;

    CitationReviewController(CitationReviewService reviews, @Value("${app.citation-reviews.enabled:false}") boolean enabled) {
        this.reviews = reviews;
        this.enabled = enabled;
    }

    @GetMapping("/api/admin/citation-reviews")
    @PreAuthorize("hasRole('ADMIN')")
    CitationReviewService.Page list(
            @RequestParam(required = false) CitationReviewService.RecordType type,
            @RequestParam(required = false) CitationReviewService.Status status,
            @RequestParam(required = false) UUID recordId,
            @RequestParam(defaultValue = "false") boolean missingSource,
            @RequestParam(defaultValue = "true") boolean needsReview,
            @RequestParam(defaultValue = "0") @Min(0) int offset,
            @RequestParam(defaultValue = "30") @Min(1) @Max(100) int limit) {
        requireEnabled();
        return reviews.list(type, status, recordId, missingSource, needsReview, offset, limit);
    }

    @PutMapping("/api/admin/citation-reviews/{type}/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    CitationReviewService.AdminRecord save(@PathVariable CitationReviewService.RecordType type, @PathVariable UUID id,
            @Valid @RequestBody CitationReviewService.ReviewRequest request, @AuthenticationPrincipal AuthPrincipal admin) {
        if (admin == null) throw new HttpResponseException(401, "Sign in as an administrator.");
        requireEnabled();
        return reviews.save(type, id, request, admin.getUserId());
    }

    @GetMapping("/api/politicians/{id}/citation-reviews")
    List<CitationReviewService.PublicReview> publicReviews(@PathVariable UUID id) {
        return enabled ? reviews.publicReviews(id) : List.of();
    }

    private void requireEnabled() {
        if (!enabled) throw new HttpResponseException(503, "Citation reviews are unavailable until the citation migration is enabled.");
    }
}
