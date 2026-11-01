<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- Confidence/abstain and conflict-detection rules live as pure functions in `src/lib/oversight.ts` (tested in `oversight.test.ts`); UI and server functions both import them so behaviour never drifts.
- Agent results (`agent_actions`) and conflicts (`task_conflicts`) are read-only to clients; all decisions go through `src/lib/oversight.functions.ts`, which checks the caller is the task owner (or the task is a demo) before writing with the admin client.
- The task replay reuses `activity_log` rows filtered by `task_id`; log every oversight step there instead of adding another history table.
