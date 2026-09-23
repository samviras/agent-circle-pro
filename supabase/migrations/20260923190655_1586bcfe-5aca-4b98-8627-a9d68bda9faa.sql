
CREATE OR REPLACE FUNCTION public.owns_agent(_agent_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.agents a WHERE a.id = _agent_id AND a.owner_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.can_see_task(_task_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = _task_id);
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
