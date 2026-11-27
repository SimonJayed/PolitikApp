create temporary table new_secretaries on commit drop as
select (value->>'id')::uuid id, value->>'name' name, value->>'position' position,
    (value->>'start')::date term_start, value->>'biography' biography, value->'names' names
from jsonb_array_elements(cast(? as jsonb)->'profiles');

create temporary table record_changes on commit drop as
select (value->'timeline'->>'timeline_id')::uuid timeline_id,
    (value->'timeline'->>'submission_id')::uuid submission_id,
    value->'timeline' timeline, nullif(value->'submission', 'null'::jsonb) submission,
    value->>'operation' operation, value->>'note' note, value->>'source' source,
    value->>'summary' summary, value->'details' details
from jsonb_array_elements(cast(? as jsonb)->'changes');
