-- H2 Compatibility Initialization for PostgreSQL Mode
CREATE SCHEMA IF NOT EXISTS public;
CREATE DOMAIN IF NOT EXISTS jsonb AS JSON;
