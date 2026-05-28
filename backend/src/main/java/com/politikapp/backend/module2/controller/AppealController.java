package com.politikapp.backend.module2.controller;

import com.politikapp.backend.auth.security.AuthPrincipal;
import com.politikapp.backend.common.HttpResponseException;
import com.politikapp.backend.module2.dto.AppealRequest;
import com.politikapp.backend.module2.dto.AppealResponse;
import com.politikapp.backend.module2.service.AppealService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/moderation")
@CrossOrigin(origins = "*")
public class AppealController {
    private final AppealService appealService;

    public AppealController(AppealService appealService) {
        this.appealService = appealService;
    }

    @PostMapping("/appeal")
    public ResponseEntity<AppealResponse> fileAppeal(
            @AuthenticationPrincipal AuthPrincipal principal,
            @Valid @RequestBody AppealRequest request
    ) {
        if (principal == null) {
            throw new HttpResponseException(401, "Unauthorized: Authentication required.");
        }
        return ResponseEntity.ok(appealService.fileAppeal(request.submissionId(), principal.getUserId()));
    }
}
