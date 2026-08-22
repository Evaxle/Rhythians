CREATE OR REPLACE FUNCTION public.cleanup_verified_rhythkit_scores()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rhythkit_maps
  WHERE created_at < now() - interval '7 days'
    AND processed_at IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_verified_rhythkit_scores() FROM public;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-verified-rhythkit-scores-weekly') THEN
    PERFORM cron.schedule(
      'cleanup-verified-rhythkit-scores-weekly',
      '0 3 * * 0',
      'SELECT public.cleanup_verified_rhythkit_scores()'
    );
  END IF;
END
$$;
