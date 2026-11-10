-- Lock the public API roles out of the public schema.
--
-- Supabase exposes the database through an HTTP API (PostgREST) as the roles
-- `anon` (not signed in) and `authenticated` (signed in). Poly'sen never uses
-- that API for data: every read and write goes through our server, which
-- connects as the database owner. So these roles get nothing.
--
-- This is the second lock. The first is row-level security, enabled with no
-- policies on every table. RLS filters rows but does not cover TRUNCATE, and a
-- table created without RLS by mistake would otherwise be wide open.

-- Tables, sequences and functions created from now on by the migration roles
-- are not granted to the API roles.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;

-- And anything that already exists.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from anon, authenticated;
