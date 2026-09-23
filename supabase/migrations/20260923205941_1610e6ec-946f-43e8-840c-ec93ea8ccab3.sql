ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS demo boolean NOT NULL DEFAULT false;

UPDATE public.agents SET demo = true WHERE slug IN ('research-agent', 'code-review-agent', 'data-cleaning-agent', 'scheduling-agent');