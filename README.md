# GitSage

GitSage is a GitHub code ownership mapper for engineering teams. It connects to a user's GitHub account, lets them pick repositories they can access, and computes ownership across files and folders using recent commit history. The app highlights leading owners, bus factor, and high-risk modules so teams can answer questions like:

- Who should review this change?
- Who likely understands this area best right now?
- Which modules are overly concentrated around one engineer?

The product is split into a web app and a serverless analysis runtime:

- The `Next.js` app handles UI, auth, server actions, and read APIs.
- `Supabase` handles auth, Postgres storage, and queue-backed job dispatch.
- Supabase Edge Functions process repository analysis jobs and write immutable snapshots.

## Why This Exists

Static ownership systems like `CODEOWNERS` are useful, but they are still manual. In fast-moving repositories, real ownership shifts over time as people refactor, extend, or replace code. GitSage uses Git activity to estimate current active ownership and surface risk signals such as bus factor and single-owner concentration.

## Tech Stack

### Application

- `Next.js 16` with App Router
- `React 19`
- `TypeScript`
- `pnpm`

### Styling and UI

- Tailwind CSS v4
- Radix UI primitives
- Lucide icons
- Framer Motion

### Auth, Database, and Queueing

- Supabase Auth
- Supabase Postgres
- Supabase Queues via `pgmq`

### GitHub Integration

- GitHub OAuth through Supabase
- Octokit for GitHub REST API access

### Background Processing

- Supabase Edge Functions
- Database webhooks triggered from `pgmq`
- Supavisor transaction pooling for direct Postgres access inside the function runtime

## Why This Architecture

The key architectural rule in this codebase is:

- Mutations flow through `server actions -> service layer -> Supabase`
- Reads flow through `app/api/v1/* -> service layer -> Supabase`
- Supabase clients are only imported in service modules that own persistence
- GitHub API access lives in a separate integration layer

This keeps responsibilities clear:

- UI components do not directly talk to Supabase
- Route handlers stay thin
- GitHub logic does not leak into pages or React components
- The ownership algorithm remains a pure compute layer that is easier to test and evolve

### Why Queue + Serverless Worker

Repository analysis is not a request-response task. It can involve:

- fetching the repo tree
- paging through commit history
- fetching commit details concurrently
- computing ownership over many files
- persisting a snapshot and its related rows

Running that inside the web request path would make the app slow and fragile. The queue + staged serverless worker split gives us:

- fast user-facing interactions
- retryable background work
- safe isolation for heavy GitHub fetches
- automatic parallelism across repositories without always-on instances

### Why GitHub OAuth

GitSage is GitHub-first. Using GitHub OAuth through Supabase gives us:

- a familiar login flow
- repository access scoped to the user's GitHub account
- no manual token entry in the UI
- a provider token that can be encrypted and reused by the analysis runtime for async analysis

## Product Flow

1. A user lands on the marketing site.
2. They sign in with GitHub.
3. Supabase completes OAuth and redirects back to the app.
4. The app stores connected-account metadata and the encrypted provider token.
5. The user visits `/repositories` and sees repositories they can access.
6. They enqueue an analysis run for a repository.
7. A database webhook triggers the Edge Function runtime, which advances the analysis stage by stage and writes an immutable snapshot.
8. The insights page reads the latest successful snapshot and shows ownership data.

## Analysis Pipeline

### High-Level Flow

When a repository is analyzed, the staged Edge Function runtime does the following:

1. Fetch the current repository tree from the default branch.
2. Filter out irrelevant files so the analysis focuses on actual code paths.
3. Fetch commit history up to the configured commit cap.
4. Fetch commit details with bounded concurrency.
5. Convert commit activity into file-level author scores.
6. Roll those scores up into folder-level ownership.
7. Compute bus factor and risk labels.
8. Persist a snapshot plus node, owner, and edge rows.

### Relevant File Filtering

The worker filters the repository tree before analysis so that ownership is not dominated by noise like:

- lockfiles
- generated artifacts
- build output
- coverage files
- static assets and similar non-code paths

This keeps the results more meaningful for engineering teams.

### Commit Fetching Strategy

We fetch commit history from the default branch and cap the total number of commits analyzed.

Current behavior:

- one analysis mode: `full`
- maximum commits fetched: `1000`
- no day-window threshold
- full tree retained for normal repository navigation

We intentionally stop after the commit cap so large repos do not generate unbounded API work.

### Why We Use Bounded Concurrency

Fetching commit details one by one is too slow for active repositories. Fetching all of them at once risks rate limits and unstable worker behavior. Instead, we use bounded concurrency:

- multiple commit-detail requests run at the same time
- but only up to a fixed limit
- as one request finishes, the next one starts

This gives us a balanced tradeoff:

- much faster than sequential fetching
- safer than unbounded parallelism
- friendlier to GitHub rate limits

The concurrency level is configurable through `ANALYSIS_COMMIT_DETAIL_CONCURRENCY`.

## Serverless Runtime

Each repository analysis run is staged:

1. `prepare`
2. `discover_commits`
3. `process_commit_batch`
4. `finalize`

One repository run advances sequentially through those stages, but different repositories can run in parallel because each queued stage insert triggers its own Edge Function invocation.

Default runtime limits:

- max commits per run: `1000`
- commit batch size per invocation: `25`
- commit-detail concurrency inside a batch: `5`

## Ownership Logic

GitSage estimates current active ownership by combining:

- contribution size
- recency
- survival of that contribution over later edits

### Step 1: Weighted Change Size

We do not treat additions and deletions equally:

`weightedLines = additions * 1.0 + deletions * 0.6`

This gives slightly more credit to authored or added code while still counting deletions as meaningful work.

### Step 2: Base Contribution Score

We soften the effect of very large commits and apply recency decay:

`baseScore = ln(1 + weightedLines) * exp(-ageInDays / 45)`

Why this helps:

- very large commits matter, but do not dominate linearly
- recent changes matter more than older changes

### Step 3: Survival / Overwrite Effect

Commits are processed in chronological order per file.

When a new commit touches a file:

- the current author gains `baseScore`
- other existing owners on that file lose some prior score

The erosion factor is:

`erosion = min(0.35, weightedLines / 500)`

For every previous owner other than the current author:

`newOwnerScore = oldOwnerScore * (1 - erosion)`

This means:

- if code stays, earlier ownership survives
- if later commits significantly replace earlier work, older ownership is reduced

This is more realistic than a purely additive churn model.

### Step 4: Final Ownership Share

After processing all commits for a file:

`ownershipShare(author) = authorScore / sum(allAuthorScores)`

That gives us the ownership percentage for each contributor.

### Step 5: Folder Rollups

Folder ownership is calculated by summing scores from descendant files. This lets us answer both:

- who owns this file?
- who owns this module or folder?

### Bus Factor and Risk

For each node, owners are sorted by share and we count how many top owners are needed to reach 70% cumulative ownership.

That count is the bus factor:

- `1` -> `critical`
- `2` -> `warning`
- `3+` -> `healthy`

This is a concentration metric, not a code-quality metric. A `critical` node means ownership is highly concentrated, not that the code is broken.

## Data Model

The core tables are:

- `profiles`
- `connected_accounts`
- `repositories`
- `analysis_runs`
- `analysis_snapshots`
- `analysis_nodes`
- `analysis_node_owners`
- `analysis_graph_edges`
- `repository_processing_locks`

### Important Concepts

- `analysis_runs` tracks stage state, retries, and progress
- `analysis_snapshots` are immutable completed analysis outputs
- `analysis_nodes` stores file/folder rows for a snapshot
- `analysis_node_owners` stores ownership breakdowns per node
- `repository_processing_locks` prevents duplicate concurrent processing of the same repository

Snapshots are immutable by design so re-runs never rewrite historical analysis.

## Deployment Model

### Web App

The Next.js app is intended to run on `Vercel`.

Responsibilities:

- public marketing pages
- authenticated application routes
- GitHub OAuth callback handling
- server actions for enqueueing analysis
- read APIs under `app/api/v1/*`

### Analysis Runtime

The analysis runtime is fully Supabase-native:

- `pgmq` stores stage jobs
- a database webhook fires one HTTP request per queued stage
- Supabase Edge Functions execute the stage
- Supavisor transaction pooling is used for direct Postgres access inside the function

Responsibilities:

- receive queued stage jobs
- acquire repository lock
- fetch GitHub data
- persist intermediate state between stages
- write snapshots and status updates

### Why Split Deployments

Vercel is a great fit for the web app, but heavy background analysis should not run inside Vercel functions. The staged Supabase runtime gives us:

- retry-safe queue processing
- serverless execution only when tasks exist
- independent scaling from the frontend

## Runtime Concurrency

The current runtime is optimized for MVP scale:

- stages stay sequential within one repository run
- commit batches stay sequential within one repository run
- bounded concurrency is only used inside one batch for GitHub requests
- multiple different repository runs can progress in parallel through independent Edge Function invocations

## Folder Structure

```text
app/
  (marketing)/              Public landing page
  (app)/repositories/       Authenticated repository views
  api/v1/                   Read-only API routes
  auth/callback/            Supabase OAuth callback finalization

src/
  actions/                  Server actions for auth and analysis mutations
  components/               Shared UI components and route-level clients
  integrations/github/      Octokit client, types, and GitHub API services
  lib/                      Pure utilities, env config, crypto helpers
  lib/analysis/             Ownership scoring and rollup logic
  services/
    _shared/                Shared service-layer helpers like Supabase clients
    auth/                   Session and connected-account persistence
    repositories/           Repository sync and summary reads
    analysis/               Queue, staged run lifecycle, locks, status, errors
    ownership/              Ownership read models for the UI and APIs
  types/                    Database, domain, and validation types

supabase/
  functions/                Edge Function worker runtime
  migrations/               Database and queue/runtime migrations
```

## Important Runtime Files

- `src/actions/auth.ts` and `src/actions/analysis.ts`
- `src/services/auth/service.ts`
- `src/services/repositories/service.ts`
- `src/services/analysis/service.ts`
- `src/services/analysis/queue-service.ts`
- `src/services/ownership/service.ts`
- `src/integrations/github/service.ts`
- `src/lib/analysis/ownership.ts`
- `supabase/functions/process-analysis-job/index.ts`

## Environment Variables

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GITHUB_TOKEN_ENCRYPTION_KEY`

Optional tuning variables:

- `ANALYSIS_COMMIT_DETAIL_CONCURRENCY`
- `ANALYSIS_LOCK_LEASE_SECONDS`
- `ANALYSIS_PROGRESS_BATCH_SIZE`
- `ANALYSIS_COMMIT_BATCH_SIZE`

Edge Function secrets:

- `ANALYSIS_DATABASE_URL` using the Supavisor transaction pooler connection string
- `OWNERSHIP_ANALYSIS_WEBHOOK_SECRET`
- `GITHUB_TOKEN_ENCRYPTION_KEY`

Database Vault secrets used by the queue trigger:

- `ownership_analysis_webhook_url`
- `ownership_analysis_webhook_secret`

## Local Development

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

Create your local env file with the variables listed above.

### 3. Apply database migrations

```bash
supabase db push
```

### 4. Configure function and webhook secrets

Set Edge Function secrets:

```bash
supabase secrets set \
  ANALYSIS_DATABASE_URL="..." \
  OWNERSHIP_ANALYSIS_WEBHOOK_SECRET="..." \
  GITHUB_TOKEN_ENCRYPTION_KEY="..."
```

Store the webhook URL and shared secret in Vault for the database trigger.

Note: the extension name is `supabase_vault`, but the SQL API is exposed through the `vault` schema.
For local development, use `host.docker.internal` so the database container can reach the Edge Function host:

```sql
select vault.create_secret(
  'http://host.docker.internal:54321/functions/v1/process-analysis-job',
  'ownership_analysis_webhook_url'
);

select vault.create_secret(
  'your-shared-webhook-secret',
  'ownership_analysis_webhook_secret'
);
```

### 5. Start the web app

```bash
pnpm dev
```

### 6. Serve the Edge Function locally

```bash
pnpm functions:serve
```

## Available Scripts

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm functions:serve
```

## Current Product Shape

Today the application is optimized around:

- GitHub-only v1
- queue-backed repository analysis
- user-scoped cached snapshots
- file and folder ownership browsing
- bus-factor-based risk signals

The current `/repositories/[repositoryId]` experience is tree-first rather than graph-first, with deeper folders expanded manually to keep navigation readable.

## Future Directions

Planned and likely next steps include:

- moving the staged runtime to Go for stronger concurrency and throughput
- richer legacy-code and dead-code graphing
- more advanced autoscaling signals for worker fleets
- further refinement of ownership heuristics
- broader provider support beyond GitHub
