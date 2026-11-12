package com.politikapp.backend.politician;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.politikapp.backend.congress.CongressDirectoryService;
import com.politikapp.backend.politician.controller.PoliticianDirectoryController;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class PoliticianDirectoryControllerTests {
    @Autowired MockMvc mvc;
    @MockitoBean CongressDirectoryService directory;

    @Test
    void guestsCanReadDirectoryMetadataWithoutFollowingPoliticianIdRoute() throws Exception {
        var person = new CongressDirectoryService.Person(UUID.randomUUID(), "Santos", "Maria",
                List.of(new CongressDirectoryService.Membership("house",19)));
        when(directory.directory()).thenReturn(new CongressDirectoryService.Directory(20, LocalDate.of(2026,11,12), List.of(person)));
        mvc.perform(get("/api/politicians/directory-memberships")).andExpect(status().isOk())
                .andExpect(jsonPath("$.currentCongress").value(20))
                .andExpect(jsonPath("$.people[0].memberships[0].chamber").value("house"))
                .andExpect(jsonPath("$.people[0].memberships[0].congress").value(19));
    }
}
