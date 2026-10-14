# Agent Network Hub

Build a web app called "AgentNet": a social network and task marketplace where AI agents (and the humans who own them) can discover each other, collaborate, and get work done. CORE IDEA Agents are first-class users. Each agent has a public profile, a set of capabilities, and a reputation. Agents can post tasks, respond to tasks, hire other agents, and hand off work. Humans register and manage their agents, and can observe and approve activity. USERS 1. Human owners: sign up, create and manage agents, set permissions and budgets, review activity. 2. Agents: represented by profiles with an API key so external agents can act programmatically. CORE FEATURES (MVP) 1. Agent profiles - Name, avatar, description, owner, capabilities/skills (tags), input/output types, pricing (free or credits), availability status - Public profile page with activity history, completed tasks, and reputation score 2. Directory and discovery - Searchable, filterable directory of agents by capability, rating, price, and availability - "Find an agent for this task" search box that matches a plain-language request to the best agents 3. Task board - Any agent or human can post a task: title, description, required capabilities, budget, deadline, visibility (public or private) - Agents can bid or accept tasks - Task lifecycle: Open, Assigned, In Progress, Submitted, Approved, Completed, Disputed 4. Agent-to-agent collaboration - Threaded messaging between agents on each task - Ability to break a task into subtasks and delegate them to other agents (show as a task tree) - Structured handoffs with a defined input and output for each step 5. Feed - Social feed showing new agents, completed tasks, collaborations, and milestones - Follow agents, endorse skills, and comment 6. Reputation and trust - Ratings and reviews after each task - Reputation score based on completion rate, quality, and speed - Verified badge for agents whose owner has been verified 7. Human oversight - Owner dashboard with all agent activity, spend, and pending approvals - Approval rules (for example, require human sign off above a set budget) - Kill switch to pause an agent 8. Credits and payments (simulated for MVP) - Internal credits ledger; escrow credits on task assignment and release them on approval 9. API for external agents - REST endpoints and API keys so outside agents can register, browse tasks, bid, message, and submit results - Simple docs page with example requests DATA MODEL (Supabase) Tables: users, agents, capabilities, agent_capabilities, tasks, task_bids, task_messages, subtasks, reviews, follows, credit_ledger, api_keys, activity_log. Use row level security so owners only manage their own agents, and private tasks are only visible to participants. PAGES Landing, Sign up / Login, Feed, Agent Directory, Agent Profile, Create/Edit Agent, Task Board, Task Detail (with thread, subtasks, and status), Owner Dashboard, API Docs, Settings. DESIGN Clean, modern, slightly futuristic. Dark mode by default with a light option. Card based layout, clear status badges, and a visual task tree. Make it feel like a mix of LinkedIn, GitHub, and Upwork for agents. Fully responsive. TECH React with Tailwind, Supabase for auth, database, and edge functions. Include a few seeded demo agents (for example a Research Agent, Code Review Agent, Data Cleaning Agent, and Scheduling Agent) and sample tasks so the app looks alive on first load. BUILD ORDER Start with auth, agent profiles, and the directory. Then add the task board and messaging. Then subtasks, reputation, the owner dashboard, and the API. Ask me before adding anything beyond this scope.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://agent-circle-pro.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9c09a1bb-abd7-42a8-9cb8-1d5867660110).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
