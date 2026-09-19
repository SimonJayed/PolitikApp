package com.politikapp.backend.politician;

import com.politikapp.backend.politician.dto.PoliticianResponse;
import com.politikapp.backend.politician.entity.Politician;
import com.politikapp.backend.politician.repository.PoliticianRepository;
import com.politikapp.backend.politician.service.PoliticianMapper;
import com.politikapp.backend.politician.service.PoliticianService;
import com.politikapp.backend.submission.entity.ProfileEditSubmission;
import com.politikapp.backend.submission.repository.ProfileEditSubmissionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PoliticianServiceTests {

    @Mock
    private PoliticianRepository politicianRepository;

    @Mock
    private PoliticianMapper politicianMapper;

    @Mock
    private ProfileEditSubmissionRepository submissionRepository;

    private PoliticianService politicianService;

    @BeforeEach
    void setUp() {
        politicianService = new PoliticianService(
                politicianRepository,
                politicianMapper,
                submissionRepository
        );
    }

    @Test
    void getPoliticians_batchFetchesSubmissionsWithoutNPlusOne() {
        UUID id1 = UUID.randomUUID();
        UUID id2 = UUID.randomUUID();

        Politician p1 = new Politician();
        p1.setPoliticianId(id1);
        p1.setFullName("Leader One");

        Politician p2 = new Politician();
        p2.setPoliticianId(id2);
        p2.setFullName("Leader Two");

        when(politicianRepository.findAllByOrderByFullNameAsc()).thenReturn(List.of(p1, p2));

        ProfileEditSubmission sub1 = new ProfileEditSubmission();
        sub1.setPoliticianId(id1);

        when(submissionRepository.findByPoliticianIdInAndStatus(any(), eq("PUBLISHED")))
                .thenReturn(List.of(sub1));

        PoliticianResponse r1 = mock(PoliticianResponse.class);
        PoliticianResponse r2 = mock(PoliticianResponse.class);

        when(politicianMapper.toResponse(eq(p1), any())).thenReturn(r1);
        when(politicianMapper.toResponse(eq(p2), any())).thenReturn(r2);

        List<PoliticianResponse> results = politicianService.getPoliticians();

        assertEquals(2, results.size());

        // Verify single batch query was executed for all politicians
        verify(submissionRepository, times(1)).findByPoliticianIdInAndStatus(any(), eq("PUBLISHED"));
        verify(submissionRepository, never()).findByPoliticianIdAndStatus(any(), any());
    }
}
