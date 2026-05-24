package com.politikapp.backend.module1.controller;

import com.politikapp.backend.module1.dto.BallotSubmissionPayload;
import com.politikapp.backend.module1.dto.SubmissionResponse;
import com.politikapp.backend.module1.service.SubmissionService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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
            @Valid @RequestBody BallotSubmissionPayload payload
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(submissionService.createSubmission(payload));
    }

    @GetMapping("/{id}")
    public ResponseEntity<SubmissionResponse> getSubmissionById(@PathVariable("id") UUID id) {
        return ResponseEntity.ok(submissionService.getSubmissionById(id));
    }
}
