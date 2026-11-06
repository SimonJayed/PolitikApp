package com.politikapp.backend.politician.dto;

import java.util.List;

public record ComparisonMatrixResponse(
        SymmetricalKpiPayload profileA,
        SymmetricalKpiPayload profileB,
        List<AlignedComparisonRow> alignedHorizontalMatrix
) {
}
