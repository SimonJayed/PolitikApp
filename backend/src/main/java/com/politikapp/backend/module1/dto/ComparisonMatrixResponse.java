package com.politikapp.backend.module1.dto;

import java.util.List;

public record ComparisonMatrixResponse(
        SymmetricalKpiPayload profileA,
        SymmetricalKpiPayload profileB,
        List<AlignedComparisonRow> alignedHorizontalMatrix
) {
}
