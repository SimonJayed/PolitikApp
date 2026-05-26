-- Flyway Database Migration: V2__create_reputation_logs
-- Author: Capstone Engineering Team

-- 1. Create the Reputation Audit Logs table
CREATE TABLE IF NOT EXISTS public.reputation_audit_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    peer_id UUID NOT NULL REFERENCES public.contributors(contributor_id) ON DELETE RESTRICT,
    queue_id UUID REFERENCES public.moderation_queue(queue_id) ON DELETE SET NULL,
    score_change NUMERIC(5, 2) NOT NULL,
    previous_score NUMERIC(5, 2) NOT NULL,
    new_score NUMERIC(5, 2) NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Deploy Index Expansion Optimization
CREATE INDEX IF NOT EXISTS idx_reputation_logs_peer_date 
ON public.reputation_audit_logs(peer_id, created_at DESC);
