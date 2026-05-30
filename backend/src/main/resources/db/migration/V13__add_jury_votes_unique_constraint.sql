-- V13__add_jury_votes_unique_constraint.sql
-- Deduplicate any existing votes to ensure the unique index does not fail
DELETE FROM public.jury_votes a 
WHERE ctid < (
  SELECT max(ctid) 
  FROM public.jury_votes b 
  WHERE a.queue_id = b.queue_id 
    AND a.peer_id = b.peer_id
);

-- Add the unique constraint to enforce voting constraint per peer
ALTER TABLE public.jury_votes ADD CONSTRAINT unique_queue_peer UNIQUE (queue_id, peer_id);
