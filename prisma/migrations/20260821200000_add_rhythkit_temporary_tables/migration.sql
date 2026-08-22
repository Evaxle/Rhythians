CREATE TABLE IF NOT EXISTS public.rhythkit_maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  map_id text NOT NULL,
  map_name text NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  matched_map_id text,
  ranked boolean,
  rhp_awarded numeric
);

CREATE INDEX IF NOT EXISTS rhythkit_maps_user_completed_idx ON public.rhythkit_maps (user_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS rhythkit_maps_map_idx ON public.rhythkit_maps (map_id);

CREATE TABLE IF NOT EXISTS public.rhythkit_connection_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'RhythKit Agent'
);

CREATE INDEX IF NOT EXISTS rhythkit_connection_tests_created_idx ON public.rhythkit_connection_tests (created_at DESC);
