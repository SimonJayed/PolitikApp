CREATE TABLE IF NOT EXISTS public.peer_applications (
    application_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contributor_id UUID NOT NULL REFERENCES public.contributors(contributor_id) ON DELETE CASCADE,
    organization_type VARCHAR(100) NOT NULL,
    institutional_email VARCHAR(255) NOT NULL,
    verification_proof_url TEXT NOT NULL,
    justification_statement TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT peer_applications_organization_type_check CHECK (
        organization_type IN ('FACULTY', 'RESEARCHER', 'CAMPUS_JOURNALIST', 'CIVIC_VOLUNTEER')
    ),
    CONSTRAINT peer_applications_status_check CHECK (
        status IN ('PENDING', 'APPROVED', 'REJECTED')
    )
);

CREATE INDEX IF NOT EXISTS idx_peer_applications_contributor_id ON public.peer_applications(contributor_id);
CREATE INDEX IF NOT EXISTS idx_peer_applications_status ON public.peer_applications(status);
