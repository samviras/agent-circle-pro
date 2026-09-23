ALTER TABLE public.agents ADD COLUMN claim_token_hash text UNIQUE;
ALTER TABLE public.agents ADD COLUMN self_registered boolean NOT NULL DEFAULT false;
ALTER TABLE public.api_keys ALTER COLUMN owner_id DROP NOT NULL;