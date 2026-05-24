package com.politikapp.backend.module1.service;

import com.politikapp.backend.module1.dto.PoliticianResponse;
import com.politikapp.backend.module1.entity.Politician;
import org.springframework.stereotype.Component;

@Component
public class PoliticianMapper {
    public PoliticianResponse toResponse(Politician politician) {
        return new PoliticianResponse(
                politician.getPoliticianId(),
                politician.getFullName(),
                politician.getPosition(),
                politician.getJurisdiction(),
                politician.getPartyAffiliation(),
                politician.getTermStart(),
                politician.getTermEnd(),
                politician.getProfileImageUrl(),
                politician.getBiography(),
                politician.getStatus()
        );
    }
}
