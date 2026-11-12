package com.politikapp.backend.politician.controller;

import com.politikapp.backend.politician.service.WgiLeaderboardService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@Validated
public class WgiLeaderboardController {
    private final WgiLeaderboardService service;
    public WgiLeaderboardController(WgiLeaderboardService service) { this.service = service; }

    @GetMapping("/api/politicians/leaderboard")
    public WgiLeaderboardService.Page leaderboard(@RequestParam(defaultValue = "0") @Min(0) int offset,
            @RequestParam(defaultValue = "8") @Min(1) @Max(50) int limit) {
        return service.leaderboard(offset, limit);
    }
}
