CREATE TABLE politician_accomplishments (
    accomplishment_id UUID PRIMARY KEY,
    politician_id UUID NOT NULL REFERENCES politicians(politician_id),
    title VARCHAR(200) NOT NULL CHECK (length(trim(title)) > 0),
    description TEXT NOT NULL CHECK (length(trim(description)) BETWEEN 1 AND 5000),
    accomplishment_date DATE,
    accomplishment_year INTEGER CHECK (accomplishment_year BETWEEN 1 AND 9999),
    category VARCHAR(100),
    source_url VARCHAR(2048) NOT NULL CHECK (length(trim(source_url)) > 0),
    visible BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (accomplishment_date IS NULL OR accomplishment_year IS NULL)
);

CREATE INDEX idx_accomplishments_politician_visibility
    ON politician_accomplishments (politician_id, visible, created_at DESC);

-- Access goes through the Spring API, not Supabase's anonymous table API.
ALTER TABLE politician_accomplishments ENABLE ROW LEVEL SECURITY;
