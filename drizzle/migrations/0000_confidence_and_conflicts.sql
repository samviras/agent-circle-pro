ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS demo boolean NOT NULL DEFAULT false;

CREATE TABLE public.agent_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'result',
  intent text NOT NULL DEFAULT 'create',
  subject text,
  summary text NOT NULL,
  scheduled_for timestamptz,
  duration_minutes integer,
  confidence text NOT NULL DEFAULT 'medium',
  confidence_reason text NOT NULL DEFAULT '',
  abstained boolean NOT NULL DEFAULT false,
  abstain_reason text,
  recommended_next_step text,
  status text NOT NULL DEFAULT 'proposed',
  seeded boolean NOT NULL DEFAULT false,
  should_have_abstained boolean,
  was_correct boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX agent_actions_task_idx ON public.agent_actions(task_id);
CREATE INDEX agent_actions_agent_idx ON public.agent_actions(agent_id);
GRANT SELECT ON public.agent_actions TO anon, authenticated;
GRANT ALL ON public.agent_actions TO service_role;
ALTER TABLE public.agent_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent actions follow task visibility" ON public.agent_actions
  FOR SELECT USING (task_id IS NULL OR public.can_see_task(task_id));

CREATE TABLE public.task_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  action_a uuid NOT NULL REFERENCES public.agent_actions(id) ON DELETE CASCADE,
  action_b uuid NOT NULL REFERENCES public.agent_actions(id) ON DELETE CASCADE,
  kind text NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  resolution text,
  combined_plan text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX task_conflicts_task_idx ON public.task_conflicts(task_id);
GRANT SELECT ON public.task_conflicts TO anon, authenticated;
GRANT ALL ON public.task_conflicts TO service_role;
ALTER TABLE public.task_conflicts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conflicts follow task visibility" ON public.task_conflicts
  FOR SELECT USING (public.can_see_task(task_id));

-- Demo capabilities
INSERT INTO public.capabilities (slug, name)
SELECT v.slug, v.name FROM (VALUES ('medication-adherence','Medication adherence'),('pharmacy','Pharmacy'),('care-coordination','Care coordination')) AS v(slug, name)
WHERE NOT EXISTS (SELECT 1 FROM public.capabilities c WHERE c.slug = v.slug);

-- Demo agents (synthetic)
INSERT INTO public.agents (id, slug, name, tagline, description, input_types, output_types, pricing_model, price_credits, availability, demo, reputation, completed_tasks) VALUES
('0a1e0000-0000-4000-8000-000000000001','adherence-agent','Adherence Agent','Keeps patients on schedule with their medication','Tracks refill dates, pickup habits and daily reminders. Usually confident, and usually right. Synthetic demo agent.','{"medication list","refill history"}','{"refill plan","reminders"}','free',0,'available',true,4.8,24),
('0a1e0000-0000-4000-8000-000000000002','pharmacy-agent','Pharmacy Agent','Checks stock and arranges pickup or delivery','Talks to pharmacy stock and delivery systems. Says "I''m not sure" when stock data is missing. Synthetic demo agent.','{"prescription","stock feed"}','{"stock check","delivery booking"}','free',0,'available',true,4.5,21),
('0a1e0000-0000-4000-8000-000000000003','quickfill-agent','QuickFill Agent','Fast answers on refills and orders','Moves fast and rarely hesitates, which means it is sometimes confidently wrong. Synthetic demo agent.','{"prescription"}','{"refill order"}','free',0,'available',true,3.9,33)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.agent_capabilities (agent_id, capability_id)
SELECT a.id, c.id FROM (VALUES
  ('0a1e0000-0000-4000-8000-000000000001'::uuid,'medication-adherence'),
  ('0a1e0000-0000-4000-8000-000000000001'::uuid,'care-coordination'),
  ('0a1e0000-0000-4000-8000-000000000002'::uuid,'pharmacy'),
  ('0a1e0000-0000-4000-8000-000000000003'::uuid,'pharmacy')
) AS a(id, slug) JOIN public.capabilities c ON c.slug = a.slug;

-- Demo tasks
INSERT INTO public.tasks (id, title, description, required_capabilities, budget_credits, visibility, status, input_spec, output_spec, demo, created_at) VALUES
('0a1e0000-0000-4000-8000-000000000101','Lisinopril refill for Ms. Rivera (demo)','Synthetic demo. Two agents are arranging the same monthly refill. You are the care manager and make the final call.','{"Medication adherence","Pharmacy"}',0,'public','in_progress','Refill due Nov 3. Patient usually picks up on Tuesdays.','One confirmed way for the patient to get the refill.',true,'2026-11-01 15:00:00+00'),
('0a1e0000-0000-4000-8000-000000000102','Metformin stock check for Mr. Chen (demo)','Synthetic demo. The pharmacy agent cannot see current stock, so it says it is not sure and recommends a human.','{"Pharmacy"}',0,'public','in_progress','Metformin 500mg, 4 days of supply left.','Confirmed pickup date.',true,'2026-11-01 15:10:00+00'),
('0a1e0000-0000-4000-8000-000000000103','Atorvastatin order for Mrs. Patel (demo)','Synthetic demo. One agent wants to order a refill, the other wants to cancel it, and one of them has low confidence.','{"Pharmacy"}',0,'public','in_progress','Possible stop note from Oct 28.','Correct refill decision.',true,'2026-11-01 15:20:00+00')
ON CONFLICT (id) DO NOTHING;

-- Demo actions on the tasks
INSERT INTO public.agent_actions (id, task_id, agent_id, kind, intent, subject, summary, scheduled_for, duration_minutes, confidence, confidence_reason, abstained, abstain_reason, recommended_next_step, status, seeded, created_at) VALUES
('0a1e0000-0000-4000-8000-000000000201','0a1e0000-0000-4000-8000-000000000101','0a1e0000-0000-4000-8000-000000000001','refill_pickup','create','refill:lisinopril','Schedule refill pickup at Main St pharmacy, Tuesday 10:00','2026-11-03 18:00:00+00',30,'high','Matched refill due date and her usual Tuesday pickup',false,NULL,NULL,'paused',true,'2026-11-01 15:01:00+00'),
('0a1e0000-0000-4000-8000-000000000202','0a1e0000-0000-4000-8000-000000000101','0a1e0000-0000-4000-8000-000000000002','home_delivery','create','refill:lisinopril','Arrange home delivery of the refill, Wednesday 14:00','2026-11-04 22:00:00+00',60,'medium','Stock confirmed, but delivery address last verified 6 months ago',false,NULL,NULL,'paused',true,'2026-11-01 15:01:30+00'),
('0a1e0000-0000-4000-8000-000000000203','0a1e0000-0000-4000-8000-000000000101','0a1e0000-0000-4000-8000-000000000001','reminder','info','reminder:daily','Send a daily 8:00 dose reminder by text',NULL,NULL,'high','Matched 3 of 3 requirements: dose, time and contact preference',false,NULL,NULL,'running',true,'2026-11-01 15:02:00+00'),
('0a1e0000-0000-4000-8000-000000000204','0a1e0000-0000-4000-8000-000000000102','0a1e0000-0000-4000-8000-000000000002','stock_check','info','refill:metformin','Confirm metformin 500mg stock and a pickup date',NULL,NULL,'low','Missing stock data: warehouse feed silent since Oct 30',true,'I can''t confirm metformin is in stock, so I can''t promise a pickup date. Guessing could leave him without medication.','human','held',true,'2026-11-01 15:11:00+00'),
('0a1e0000-0000-4000-8000-000000000205','0a1e0000-0000-4000-8000-000000000103','0a1e0000-0000-4000-8000-000000000003','order_refill','create','refill:atorvastatin','Order a 90-day atorvastatin refill',NULL,NULL,'high','Matched last order and insurance plan',false,NULL,NULL,'paused',true,'2026-11-01 15:21:00+00'),
('0a1e0000-0000-4000-8000-000000000206','0a1e0000-0000-4000-8000-000000000103','0a1e0000-0000-4000-8000-000000000002','cancel_refill','cancel','refill:atorvastatin','Cancel the atorvastatin refill: possible stop note from Oct 28',NULL,NULL,'low','Saw a stop note, but the prescription record is incomplete',false,NULL,NULL,'paused',true,'2026-11-01 15:21:30+00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.task_conflicts (id, task_id, action_a, action_b, kind, reason, status, created_at) VALUES
('0a1e0000-0000-4000-8000-000000000301','0a1e0000-0000-4000-8000-000000000101','0a1e0000-0000-4000-8000-000000000201','0a1e0000-0000-4000-8000-000000000202','duplicate','Both plans deliver the same lisinopril refill. Doing both means two refills and a double charge.','open','2026-11-01 15:02:30+00'),
('0a1e0000-0000-4000-8000-000000000302','0a1e0000-0000-4000-8000-000000000103','0a1e0000-0000-4000-8000-000000000205','0a1e0000-0000-4000-8000-000000000206','contradiction','One agent orders the atorvastatin refill while the other cancels it. They can''t both happen.','open','2026-11-01 15:22:00+00')
ON CONFLICT (id) DO NOTHING;

-- Replay entries for the seeded steps
INSERT INTO public.activity_log (actor_agent_id, task_id, type, message, created_at) VALUES
('0a1e0000-0000-4000-8000-000000000001','0a1e0000-0000-4000-8000-000000000101','confidence','proposed "Schedule refill pickup at Main St pharmacy, Tuesday 10:00" with High confidence: Matched refill due date and her usual Tuesday pickup','2026-11-01 15:01:00+00'),
('0a1e0000-0000-4000-8000-000000000002','0a1e0000-0000-4000-8000-000000000101','confidence','proposed "Arrange home delivery of the refill, Wednesday 14:00" with Medium confidence: Stock confirmed, but delivery address last verified 6 months ago','2026-11-01 15:01:30+00'),
('0a1e0000-0000-4000-8000-000000000001','0a1e0000-0000-4000-8000-000000000101','confidence','proposed "Send a daily 8:00 dose reminder by text" with High confidence: Matched 3 of 3 requirements: dose, time and contact preference','2026-11-01 15:02:00+00'),
(NULL,'0a1e0000-0000-4000-8000-000000000101','conflict_detected','Ostrin found a duplicate: Both plans deliver the same lisinopril refill. Doing both means two refills and a double charge.','2026-11-01 15:02:30+00'),
(NULL,'0a1e0000-0000-4000-8000-000000000101','paused','Ostrin paused both refill plans until the care manager decides. The daily reminder keeps going.','2026-11-01 15:02:31+00'),
('0a1e0000-0000-4000-8000-000000000002','0a1e0000-0000-4000-8000-000000000102','confidence','proposed "Confirm metformin 500mg stock and a pickup date" with Low confidence: Missing stock data: warehouse feed silent since Oct 30','2026-11-01 15:11:00+00'),
('0a1e0000-0000-4000-8000-000000000002','0a1e0000-0000-4000-8000-000000000102','abstain','abstained: "I''m not sure." Recommended next step: hand to a human','2026-11-01 15:11:01+00'),
(NULL,'0a1e0000-0000-4000-8000-000000000102','held','Ostrin held this result for the care manager. It can''t be approved with one tap.','2026-11-01 15:11:02+00'),
('0a1e0000-0000-4000-8000-000000000003','0a1e0000-0000-4000-8000-000000000103','confidence','proposed "Order a 90-day atorvastatin refill" with High confidence: Matched last order and insurance plan','2026-11-01 15:21:00+00'),
('0a1e0000-0000-4000-8000-000000000002','0a1e0000-0000-4000-8000-000000000103','confidence','proposed "Cancel the atorvastatin refill: possible stop note from Oct 28" with Low confidence: Saw a stop note, but the prescription record is incomplete','2026-11-01 15:21:30+00'),
(NULL,'0a1e0000-0000-4000-8000-000000000103','conflict_detected','Ostrin found a contradiction: One agent orders the atorvastatin refill while the other cancels it. They can''t both happen.','2026-11-01 15:22:00+00'),
(NULL,'0a1e0000-0000-4000-8000-000000000103','paused','Ostrin paused both actions. One side has Low confidence, so reconciling is skipped and this goes to a human.','2026-11-01 15:22:01+00');

-- Synthetic track record used for the "Knows its limits" stat
INSERT INTO public.agent_actions (agent_id, kind, summary, confidence, confidence_reason, abstained, status, seeded, should_have_abstained, was_correct, created_at)
SELECT '0a1e0000-0000-4000-8000-000000000001'::uuid, 'history', 'Past refill plan', 'high', 'History', false, 'approved', true, false, g <= 19, '2026-10-01'::timestamptz + g * interval '1 day' FROM generate_series(1,20) g
UNION ALL SELECT '0a1e0000-0000-4000-8000-000000000001'::uuid, 'history', 'Past case with missing data', 'low', 'History', true, 'handed_to_human', true, true, true, '2026-10-01'::timestamptz + g * interval '1 day' FROM generate_series(1,3) g
UNION ALL SELECT '0a1e0000-0000-4000-8000-000000000002'::uuid, 'history', 'Past case with missing stock data', 'low', 'History', g <= 9, 'handed_to_human', true, true, g <= 9, '2026-10-01'::timestamptz + g * interval '1 day' FROM generate_series(1,10) g
UNION ALL SELECT '0a1e0000-0000-4000-8000-000000000002'::uuid, 'history', 'Past cautious abstain', 'low', 'History', true, 'handed_to_human', true, false, true, '2026-10-01'::timestamptz + g * interval '1 day' FROM generate_series(1,3) g
UNION ALL SELECT '0a1e0000-0000-4000-8000-000000000002'::uuid, 'history', 'Past delivery booking', 'high', 'History', false, 'approved', true, false, true, '2026-10-01'::timestamptz + g * interval '1 day' FROM generate_series(1,8) g
UNION ALL SELECT '0a1e0000-0000-4000-8000-000000000003'::uuid, 'history', 'Past case with missing data', CASE WHEN g = 1 THEN 'low' ELSE 'high' END, 'History', g = 1, 'approved', true, true, g = 1, '2026-10-01'::timestamptz + g * interval '1 day' FROM generate_series(1,8) g
UNION ALL SELECT '0a1e0000-0000-4000-8000-000000000003'::uuid, 'history', 'Past refill order', 'high', 'History', false, 'approved', true, false, g <= 18, '2026-10-01'::timestamptz + g * interval '1 day' FROM generate_series(1,25) g;