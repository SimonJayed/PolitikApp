package com.politikapp.backend.news;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.politikapp.backend.common.GlobalExceptionHandler;
import com.politikapp.backend.news.controller.AdminNewsController;
import com.politikapp.backend.news.service.AdminNewsService;
import com.politikapp.backend.news.service.GovernmentNewsRetrievalService;
import com.politikapp.backend.news.service.NewsRetrievalJob;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class AdminNewsPaginationTests {
    private AdminNewsService service;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        service = mock(AdminNewsService.class);
        mvc = MockMvcBuilders.standaloneSetup(new AdminNewsController(service,
                mock(NewsRetrievalJob.class), mock(GovernmentNewsRetrievalService.class)))
                .setControllerAdvice(new GlobalExceptionHandler()).build();
    }

    @Test
    void secondPagePreservesStatusAndUsesZeroBasedPageIndex() throws Exception {
        when(service.list(eq("PENDING_REVIEW"), any(Pageable.class)))
                .thenAnswer(call -> Page.empty(call.getArgument(1, Pageable.class)));
        mvc.perform(get("/api/admin/news").param("status", "PENDING_REVIEW")
                .param("page", "1").param("size", "20"))
                .andExpect(status().isOk());
        verify(service).list(eq("PENDING_REVIEW"), argThat(page ->
                page.getPageNumber() == 1 && page.getPageSize() == 20));
    }

    @Test
    void invalidPageIsABadRequestRatherThanAnInternalServerError() throws Exception {
        mvc.perform(get("/api/admin/news").param("page", "NaN"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
        verifyNoInteractions(service);
    }
}
