package com.politikapp.backend.module3.dto;

public record PeerApplicationPayload(
    String organizationType,
    String institutionalEmail,
    String verificationProofUrl,
    String justificationStatement
) {}
