package com.politikapp.backend.module1.controller;

import com.politikapp.backend.module1.dto.BallotSubmissionPayload;
import com.politikapp.backend.module1.dto.SubmissionResponse;
import com.politikapp.backend.module1.service.SubmissionService;
import com.politikapp.backend.auth.security.AuthPrincipal;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/submissions")
@CrossOrigin(origins = "*")
public class EditSubmissionController {
    private final SubmissionService submissionService;

    public EditSubmissionController(SubmissionService submissionService) {
        this.submissionService = submissionService;
    }

    @PostMapping
    public ResponseEntity<SubmissionResponse> submitPoliticianEdit(
            @AuthenticationPrincipal AuthPrincipal principal,
            @Valid @RequestBody BallotSubmissionPayload payload
    ) {
        UUID contributorId = principal != null ? principal.getUserId() : payload.contributorId();
        return ResponseEntity.status(HttpStatus.CREATED).body(submissionService.createSubmission(payload, contributorId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<SubmissionResponse> getSubmissionById(@PathVariable("id") UUID id) {
        return ResponseEntity.ok(submissionService.getSubmissionById(id));
    }

    @GetMapping("/my")
    public ResponseEntity<java.util.List<SubmissionResponse>> getMySubmissions(
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        if (principal == null) {
            throw new com.politikapp.backend.common.HttpResponseException(401, "Authentication required.");
        }
        return ResponseEntity.ok(submissionService.getSubmissionsByContributor(principal.getUserId()));
    }

    @GetMapping("/contributor/{contributorId}")
    public ResponseEntity<java.util.List<SubmissionResponse>> getSubmissionsByContributor(
            @PathVariable("contributorId") UUID contributorId
    ) {
        return ResponseEntity.ok(submissionService.getSubmissionsByContributor(contributorId));
    }
}
