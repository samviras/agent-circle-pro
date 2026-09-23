DROP POLICY IF EXISTS "activity insert" ON public.activity_log;
CREATE POLICY "activity insert own identity"
ON public.activity_log
FOR INSERT
TO authenticated
WITH CHECK (
  (actor_user_id = auth.uid() AND actor_agent_id IS NULL)
  OR
  (actor_user_id IS NULL AND actor_agent_id IS NOT NULL AND public.owns_agent(actor_agent_id))
);

DROP POLICY IF EXISTS "tasks update" ON public.tasks;
CREATE POLICY "task creators update"
ON public.tasks
FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

CREATE POLICY "assigned agent owners update"
ON public.tasks
FOR UPDATE
TO authenticated
USING (assigned_agent_id IS NOT NULL AND public.owns_agent(assigned_agent_id))
WITH CHECK (assigned_agent_id IS NOT NULL AND public.owns_agent(assigned_agent_id));

CREATE OR REPLACE FUNCTION public.protect_task_update_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
      RAISE EXCEPTION 'Task creator cannot be changed';
    END IF;
    IF OLD.created_by IS DISTINCT FROM auth.uid() THEN
      IF NEW.assigned_agent_id IS DISTINCT FROM OLD.assigned_agent_id
         OR NEW.posted_by_agent IS DISTINCT FROM OLD.posted_by_agent
         OR NEW.parent_task_id IS DISTINCT FROM OLD.parent_task_id
         OR NEW.title IS DISTINCT FROM OLD.title
         OR NEW.description IS DISTINCT FROM OLD.description
         OR NEW.required_capabilities IS DISTINCT FROM OLD.required_capabilities
         OR NEW.budget_credits IS DISTINCT FROM OLD.budget_credits
         OR NEW.deadline IS DISTINCT FROM OLD.deadline
         OR NEW.visibility IS DISTINCT FROM OLD.visibility
         OR NEW.input_spec IS DISTINCT FROM OLD.input_spec
         OR NEW.output_spec IS DISTINCT FROM OLD.output_spec THEN
        RAISE EXCEPTION 'Assigned agents may only update task progress and results';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_task_update_identity ON public.tasks;
CREATE TRIGGER protect_task_update_identity
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.protect_task_update_identity();

DROP POLICY IF EXISTS "bids update" ON public.task_bids;
CREATE POLICY "agent owners update own bids"
ON public.task_bids
FOR UPDATE
TO authenticated
USING (public.owns_agent(agent_id))
WITH CHECK (public.owns_agent(agent_id));

CREATE POLICY "task creators update received bids"
ON public.task_bids
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_bids.task_id
      AND t.created_by = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_bids.task_id
      AND t.created_by = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.protect_bid_update_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NEW.task_id IS DISTINCT FROM OLD.task_id OR NEW.agent_id IS DISTINCT FROM OLD.agent_id THEN
      RAISE EXCEPTION 'Bid task and agent cannot be changed';
    END IF;
    IF public.owns_agent(OLD.agent_id) THEN
      IF NEW.status IS DISTINCT FROM OLD.status THEN
        RAISE EXCEPTION 'Only the task creator may change bid status';
      END IF;
    ELSE
      IF NEW.message IS DISTINCT FROM OLD.message OR NEW.price_credits IS DISTINCT FROM OLD.price_credits THEN
        RAISE EXCEPTION 'Task creators may only change bid status';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_bid_update_identity ON public.task_bids;
CREATE TRIGGER protect_bid_update_identity
BEFORE UPDATE ON public.task_bids
FOR EACH ROW
EXECUTE FUNCTION public.protect_bid_update_identity();