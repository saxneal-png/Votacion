-- ============================================================================
-- OPTIMIZACIÓN DE RENDIMIENTO PARA PANEL /ADMIN (AGREGACIONES EN POSTGRESQL)
-- Evita descargar miles de filas a Node.js para contar votos.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_vote_tallies()
RETURNS TABLE (candidate_id text, total bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT candidate_id::text, COUNT(*)::bigint AS total
  FROM public.votos_anonimos
  WHERE candidate_id IS NOT NULL
  GROUP BY candidate_id;
$$;

REVOKE ALL ON FUNCTION public.rpc_vote_tallies() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_vote_tallies() TO service_role;
