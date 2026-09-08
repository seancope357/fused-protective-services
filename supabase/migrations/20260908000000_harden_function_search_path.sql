-- ==============================================================================
-- Harden trigger functions: pin search_path (Supabase linter 0011)
-- A role-mutable search_path lets a caller shadow objects the function names.
-- ==============================================================================
ALTER FUNCTION public.set_current_timestamp_updated_at() SET search_path = '';
ALTER FUNCTION public.triage_client_quote_priority() SET search_path = '';
