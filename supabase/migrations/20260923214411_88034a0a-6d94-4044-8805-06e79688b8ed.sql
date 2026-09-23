DROP POLICY IF EXISTS "activity readable" ON public.activity_log;
CREATE POLICY "activity respects task visibility"
ON public.activity_log
FOR SELECT
TO public
USING (
  task_id IS NULL
  OR public.can_see_task(task_id)
);