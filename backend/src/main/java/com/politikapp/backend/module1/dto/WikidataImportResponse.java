package com.politikapp.backend.module1.dto;

public record WikidataImportResponse(
        int importedCount,
        String message
) {
}
