# Gym Finder: Stack and Schema Discussion

Phase 2 of the roadmap, step 2. The high-level design is settled in [DESIGN_DISCUSSION.md](./DESIGN_DISCUSSION.md) (PR #6): **Option B**, a modular monolith API plus background workers on a queue, Postgres + PostGIS, and two modes (cheap **demo** mode, **scale** mode) picked by one setting at startup. Requirement IDs (FR-x, NFR-x) refer to [REQUIREMENTS.md](./REQUIREMENTS.md).

This doc covers what's still open: **which tools build Option B** (part 1) and **what the database looks like** (part 2). The API is the next doc.

**Decided by Joey (2026-10-31): hosting is AWS.** This replaces the earlier Netlify + GCP e2-micro idea. Everything in part 1 assumes AWS.

Each section lists the variations, pros and cons, and a **recommendation**. Nothing here is final until Joey signs off in review. Prices are rough on-demand list prices for a US region, to compare options, not quotes; check the AWS pricing pages before buying.

---

## Part 1: Stack

### 1.1 Backend language and framework

The Expo app is TypeScript. The demo server (`server/index.js`) is plain JavaScript on Express 5.

| Variation | Pros | Cons |
|---|---|---|
| **TypeScript + Fastify** | Same language as the app, so request/response types and validation schemas can be shared. Built-in schema validation and good performance. Plugin system maps neatly onto modules (map, chat, sweeps, auth). | Rewrite of the Express routes (they're small). |
| TypeScript + Express 5 | Smallest change from the demo code. Everyone knows it. | No built-in validation or typing; we'd bolt those on. Slower than Fastify (doesn't matter at our load). |
| TypeScript + NestJS | Strong structure (modules, dependency injection), good for big teams. | Lots of boilerplate and framework concepts for a one-person project. |
| TypeScript + Hono | Tiny, fast, runs anywhere (Lambda, Node, edge). | Younger ecosystem; its main strength (edge/serverless) isn't what we're using. |
| Python (FastAPI) or Go | Python is great for scraping/AI; Go is very fast. | Two languages in the repo, no shared types with the app, and Claude sessions have to switch context. |

**Recommendation: TypeScript + Fastify, with Zod schemas shared between app and server.** One language for everything is the biggest win for a solo developer working with several Claudes in parallel.

#### Repo layout

To share types, the repo becomes a small monorepo using npm workspaces:

```
apps/mobile      Expo app (today's src/)
apps/server      Fastify API + workers (one codebase, two entry points)
packages/shared  Zod schemas, types, constants (gym categories, request statuses)
infra/           AWS CDK code (section 1.6)
```

- ✅ The app and server can't drift apart on request shapes.
- ✅ Each module folder in `apps/server/src/modules/*` is a natural unit for one Claude session to build.
- ❌ One-time move of files, and Expo needs a small Metro config tweak for workspaces (documented and supported).

The server has **one codebase and two entry points**: `api.ts` (HTTP) and `worker.ts` (queue consumers). In demo mode both run in one process.

### 1.2 Job queue library

The design needs one queue interface with a Postgres-backed implementation (demo) and a fast one (scale).

| Variation | Demo | Scale | Pros | Cons |
|---|---|---|---|---|
| **pg-boss + BullMQ** | pg-boss (Postgres) | BullMQ (Redis) | Both mature, both have retries, delays, cron schedules, priorities. BullMQ adds per-queue rate limits and job-ID dedupe, which sweeps need. | Two libraries to wrap behind one interface; features differ slightly (we use the overlap). |
| pg-boss everywhere | pg-boss | pg-boss | One library, no Redis needed for queues at all; jobs can be created in the same transaction as the request row. | Adds load to the main database; lower ceiling than Redis. Fine at 10k DAU, weaker near NFR-2's 1,000/s. |
| graphile-worker + BullMQ | graphile-worker | BullMQ | graphile-worker is very fast for a Postgres queue. | Smaller feature set than pg-boss (no built-in priorities per queue in the same way). |
| pg-boss + Amazon SQS | pg-boss | SQS | Fully managed, no Redis to run, "very AWS". | No built-in rate limiting or job priorities; delays capped at 15 min; dedupe only on FIFO queues for 5 minutes. We'd rebuild what BullMQ gives for free. |

```mermaid
flowchart LR
    BIZ[Business code<br/>chat, sweeps, bot review] --> QI[Queue interface<br/>add, process, schedule]
    QI -->|MODE=demo| PB[PgBossQueue<br/>tables in Postgres]
    QI -->|MODE=scale| BQ[BullMqQueue<br/>ElastiCache Redis]
```

**Recommendation: pg-boss in demo mode, BullMQ in scale mode.** This matches the agreed design (Redis in scale mode, Postgres table in demo mode). The interface only exposes what both support: `add(queue, payload, {priority, delay, jobId})`, `process(queue, handler, {concurrency})`, `schedule(cron)`. The per-source rate limiter (don't hammer Google Maps) lives in our own small module, backed by Postgres in demo and Redis in scale, so it works the same either way.

### 1.3 Database access and migrations

The schema leans on PostGIS (points, `ST_Within`, `ST_GeoHash`), JSONB and full-text search, so the tool must handle those without fighting us.

| Variation | Pros | Cons |
|---|---|---|
| **Drizzle ORM + drizzle-kit** | Schema written in TypeScript; generates SQL migrations you can read and edit. Supports PostGIS geometry columns. SQL-like query builder, so complex geo queries stay readable; raw `sql` escape hatch. Light, no engine binary. | Younger than Prisma; some advanced Postgres features need raw SQL. |
| Prisma | Very popular, great docs, nice schema language. | PostGIS types are "Unsupported", so every geo query is raw SQL with no typing. Heavier runtime. |
| Kysely + plain SQL migrations | Excellent type safety; you write real SQL. | No schema-as-code; types generated from the database. More manual. |
| Raw `pg` + SQL files (today) | No abstraction; full control. | No types for query results; easy to make mistakes as the schema grows. |

**Recommendation: Drizzle**, with migrations checked into git and run automatically on deploy. Geo queries that Drizzle can't express go through its `sql` template, which is still parameterized.

### 1.4 Auth (FR-13, FR-14, FR-15)

The demo server has its own sign-up with bcrypt + JWT. A real app needs password reset, email verification, Google sign-in, and **Sign in with Apple** (Apple requires it on iOS if any other social login is offered).

| Variation | Pros | Cons |
|---|---|---|
| **Better Auth** (open-source TS library) | Users, sessions and accounts live in **our** Postgres, so no vendor lock-in and no per-user cost. Email/password, Google, Apple, email verification, password reset built in. Has an Expo integration. Roles via a plugin or a `role` column. | We run it ourselves (it's a library inside the API, not a service). Younger project than the others. |
| Amazon Cognito | AWS-native, managed, free for a generous number of monthly users. | Known for awkward developer experience (hosted UI, token handling in React Native). Users live in Cognito, so joining "user → requests" means syncing IDs. Hard to migrate away from (password hashes can't be exported). |
| Clerk / Auth0 | Polished UI components, Expo SDKs, very quick to set up. | Paid beyond free tiers; users live with the vendor; lock-in. |
| Keep our own bcrypt + JWT | Already written. | Password reset, email verification, social login, token refresh and rate limiting all have to be built and secured by us. Easy to get wrong. |

**Recommendation: Better Auth.** It keeps the "no lock-in, data in Postgres" principle and saves writing security code. Cognito is the fallback if Joey prefers everything AWS-managed.

### 1.5 AWS hosting: demo mode

Goal: one cheap server, no paid managed services beyond small fixed costs.

```mermaid
flowchart TB
    U([Expo app<br/>Web / Android / iOS]) --> CF[CloudFront CDN<br/>web app, gym tiles, base map]
    CF --> S3[(S3<br/>web build, base map PMTiles)]
    CF --> LS
    subgraph LS[Lightsail instance, Docker Compose]
        API[API process]
        WK[Worker process<br/>pg-boss consumers, Playwright]
        PG[(Postgres + PostGIS<br/>+ pg-boss tables)]
    end
    WK --> OL[Ollama<br/>Joey's PC via tunnel,<br/>or small model on the box]
    PG -. nightly pg_dump .-> S3B[(S3 backups)]
```

| Variation | Monthly cost (rough) | Pros | Cons |
|---|---|---|---|
| **Lightsail instance (4 GB)**, Postgres in Docker on the box | ~$24 | Fixed price incl. bandwidth and a static IP; simplest. | Database on the same box; we do backups ourselves (nightly `pg_dump` to S3). |
| Lightsail 2 GB | ~$12 | Cheapest that runs Postgres + API + worker. | Too small for Playwright + Ollama on the box. |
| EC2 t4g.small/medium + EBS | ~$15–30 | Same building block scale mode can grow from; ARM is cheap. | Bandwidth, IP and disk billed separately; more knobs. |
| EC2 + RDS (db.t4g.micro) | ~$30–45 | Managed backups from day one; moving to scale mode is easier. | RDS roughly doubles the demo bill for a database that has almost no load. |

New AWS accounts get starter credits for the first months, which cover most of this at the start.

**Recommendation: one Lightsail instance (4 GB) running Docker Compose**, Postgres+PostGIS in a container with nightly backups to S3, and S3 + CloudFront for the web build, base map and public gym tiles. DNS on Route 53 so it's all in one account.

#### Ollama on AWS: the expensive part

| Variation | Monthly cost | Pros | Cons |
|---|---|---|---|
| **Small model on Joey's own PC, reached through a tunnel** (Tailscale or Cloudflare Tunnel) | $0 | Free; can run a bigger model if the PC has a GPU. | Chat is down when the PC is off. Bot review and chat jobs just wait in the queue (they're allowed to fail and the user is told). |
| Small model (~3B, quantized) on the demo box's CPU | ~$20 more (needs an 8 GB box) | Always on. | Slow (several seconds per answer) and lower quality. |
| GPU instance (g4dn.xlarge / g5.xlarge) | ~$380–730 on-demand, 24/7 | Fast, good quality. | Costs more than everything else combined; defeats the point of demo mode. |
| GPU spot instance started on demand | Pay per hour used | Cheap per hour. | Cold start of minutes; spot can be taken away. Complex for a demo. |

**Recommendation: Joey's PC via a tunnel while demoing, falling back to a small CPU model on the box if it needs to be always-on.** Scale mode moves to Claude anyway, so we should not buy GPU capacity for Ollama.

### 1.6 AWS hosting: scale mode

```mermaid
flowchart TB
    U([Expo app]) --> CF[CloudFront<br/>web app, base map,<br/>public gym tiles]
    CF --> ALB[Application Load Balancer]
    ALB --> API[ECS Fargate: API<br/>2..N tasks, scale on CPU]
    API <--> EC[(ElastiCache Redis / Valkey<br/>cache + BullMQ queues)]
    API <--> RDS[(RDS Postgres + PostGIS<br/>+ read replica later)]
    EC --> WC[ECS Fargate: chat + bot-review workers<br/>scale on queue depth]
    EC --> WS[ECS Fargate: sweep workers<br/>Playwright, capped count]
    WC --> CL[Claude API<br/>direct or via Amazon Bedrock]
    WS --> SRC[Overpass, Google Maps scraper,<br/>optional proxy service]
    WC & WS --> RDS
    CW[CloudWatch metric:<br/>queue depth] -. drives autoscaling .-> WC & WS
```

| Piece | Variations | Recommendation and why |
|---|---|---|
| Compute | **ECS on Fargate**, EKS (Kubernetes + KEDA), App Runner, Lambda | **ECS Fargate.** No servers to patch, scales services on any CloudWatch metric (we publish queue depth). EKS is more powerful but costs ~$73/month just for the control plane and needs Kubernetes skills. App Runner can't run background workers that scale on queue depth. Lambda's 15-minute limit and cold starts fit badly with sweeps and Playwright. |
| Database | **RDS Postgres**, Aurora Postgres, Aurora Serverless v2 | **RDS Postgres** with PostGIS. Simple and cheapest at our size. Aurora is worth it for very high read scale or fast failover, which we don't need yet; the move later is a managed migration. |
| Cache + queue | **ElastiCache (Redis/Valkey)**, ElastiCache Serverless, Upstash | **ElastiCache**, one small node to start. Keeps everything in AWS and inside the VPC (low latency). Upstash was the earlier idea; it still works through the cache interface if we want pay-per-request. |
| LLM | Claude via Anthropic API, Claude via **Amazon Bedrock** | Either, behind the LLM interface. Anthropic API gets new models first; Bedrock keeps billing and permissions in AWS. **Decide when we switch to scale mode.** |
| Infrastructure as code | **AWS CDK (TypeScript)**, Terraform, SST, clicking in the console | **CDK in TypeScript**, same language as everything else. Console clicking can't be reviewed or repeated; Terraform is equally good but another language. |
| Secrets/config | SSM Parameter Store, Secrets Manager | **SSM Parameter Store** (free for standard params); env vars injected into containers. Never in git. |
| Logs/errors | CloudWatch Logs, + Sentry | **CloudWatch for logs, Sentry free tier for app + server errors** (it has an Expo SDK). |

Scale mode with the smallest sizes is very roughly **$150–300/month** before Claude usage (ALB, two Fargate services, small RDS, small ElastiCache, NAT). That's why demo mode stays on Lightsail until there are paying users.

### 1.7 Map rendering and base map tiles

Two different kinds of "tiles" are involved:
- **Base map tiles**: the streets and land picture under the gyms.
- **Gym data tiles**: our geohash cells of gym JSON (agreed design).

Today the app uses Leaflet on web and Leaflet inside a WebView on Android/iOS, with base tiles from `tile.openstreetmap.org`. **The public OSM tile servers' usage policy forbids heavy app traffic**, so that has to change before launch regardless.

| Variation | Pros | Cons |
|---|---|---|
| **MapLibre** (maplibre-gl-js on web, maplibre-react-native on mobile) + **Protomaps** vector tiles as one PMTiles file on S3 + CloudFront | Real native map on phones (smooth pan/zoom, many markers), same style on all platforms. Self-hosted base map costs only S3 + CloudFront transfer; no per-view fees. | Needs an Expo dev build (no Expo Go) for the native map module. Rewrite of the map screens. |
| Keep Leaflet / WebView, switch base tiles to a provider (MapTiler, Stadia, Thunderforest) | No rewrite; just change the tile URL. | WebView map feels sluggish on mobile with many markers. Provider free tiers are small; per-view fees grow with users. |
| react-native-maps (Apple/Google maps) + Leaflet/MapLibre on web | Native look on each platform. | Two different map libraries to maintain; Google Maps SDK has its own usage costs and terms. |

**Recommendation: MapLibre + self-hosted Protomaps on S3/CloudFront.** As a quick first step before the rewrite, point Leaflet at the same Protomaps tiles (or a provider) so we stop using the OSM servers.

### 1.8 Getting results back to the app (chat, request status)

Chat answers and sweep results come from workers, not the request that started them.

| Variation | Pros | Cons |
|---|---|---|
| **Polling** `GET /requests/:id` every few seconds | Simplest; works through any CDN/load balancer; stateless. | Slight delay; extra requests (cheap at our scale). |
| **Server-Sent Events** for chat streaming | Shows the answer as it's typed out; plain HTTP, works on ALB. | Needs a Redis/Postgres pub-sub so the API process can hear what the worker wrote. |
| WebSockets (own, or API Gateway WebSockets) | Two-way, real-time. | More infrastructure; we don't need two-way. |
| **Expo push notifications** for "My requests" status changes | User learns a sweep finished without keeping the app open (FR-18). | Needs push token storage and permission prompt. |

**Recommendation: polling for request status at first, SSE for chat streaming when we want the typing effect, and Expo push notifications for status changes on "My requests".**

### 1.9 Scraper infrastructure (FR-11)

Decided in PR #6: sweeps scrape Google Maps, behind the pluggable source interface.

| Variation | Pros | Cons |
|---|---|---|
| **Playwright + headless Chromium inside the sweep worker container** | Already used by the demo; one image; shares the queue and rate limiter. | Chromium needs ~1 GB RAM per browser, so sweep workers are bigger containers with a low max count. |
| A separate scraping service / Lambda | Isolated from other workers. | Lambda + Chromium is fiddly (size limits); not needed with a capped worker pool. |
| Paid scraping API (handles proxies and blocks for you) | Least work, fewer blocks. | Per-request fees. |
| **Rotating residential proxies** added to Playwright | Fewer blocks than AWS IPs, which Google recognises as datacenter traffic. | Monthly fee; only worth it once blocks actually happen. |

**Recommendation: Playwright in the sweep worker, slow shared rate limit, no proxy at first.** Add a proxy provider through config only if AWS IPs get blocked.

### 1.10 Stack summary

| Area | Recommendation |
|---|---|
| Language / framework | TypeScript, Fastify, Zod shared with the app, npm-workspaces monorepo |
| Queue | pg-boss (demo) / BullMQ on Redis (scale) behind one interface |
| DB access | Drizzle ORM + drizzle-kit migrations |
| Auth | Better Auth, users in our Postgres (Cognito as fallback) |
| Demo hosting | Lightsail 4 GB + Docker Compose; S3 + CloudFront + Route 53 |
| Scale hosting | ECS Fargate, RDS Postgres, ElastiCache, CDK, SSM, CloudWatch + Sentry |
| LLM | Ollama on Joey's PC via tunnel (demo); Claude via API or Bedrock (scale) |
| Map | MapLibre + Protomaps on S3/CloudFront |
| Results to app | Polling, SSE for chat, Expo push for status changes |
| Scraper | Playwright in sweep workers, proxy only if blocked |

---

## Part 2: Database schema

### 2.1 What the schema must support

- Map reads by tile with filters: drop-in, trial, category, text (FR-4, 5, 10).
- Gym details incl. prices in many currencies, hours, description (FR-7).
- Facts found by chat saved after review (FR-9).
- Sweeps and Overpass refresh per tile, deduped against known gyms (FR-11, 12).
- Users, admins (FR-13, 14).
- Requests with `pending / completed / failed`, deadline, retry, and review outcome `approved / rejected` (FR-16, 17, 18, and the PR #6 decision on failed jobs).
- **Approval rule (Joey, 2026-10-31):** a gym can skip admin approval if a bot verifies it; a price change is verified if it's found on the gym's website or on a price menu less than one year old. Everything unverified goes to an admin. So every fact needs its **source** and **date**.

### 2.2 Proposed schema (overview)

```mermaid
erDiagram
    users ||--o{ requests : makes
    users ||--o{ reviews : writes
    requests ||--o{ gym_changes : produces
    gyms ||--o{ gym_changes : "changed by"
    gyms ||--o{ gym_prices : has
    gyms ||--o{ gym_source_refs : "known in"
    gyms ||--o{ reviews : has
    gym_changes ||--o| gym_prices : "creates (when approved)"
    tiles ||--o{ tile_fetches : "per source"

    users {
        bigint id PK
        text email
        text role "user | admin"
    }
    gyms {
        bigint id PK
        text name
        geometry location "Point, 4326"
        text geohash5 "generated, indexed"
        text_array categories
        bool accepts_drop_in
        bool has_trial
        int day_pass_usd_cents "current, denormalized"
        jsonb details "hours, amenities, ..."
        tsvector search "generated"
        text status "active | closed | hidden"
    }
    gym_prices {
        bigint id PK
        bigint gym_id FK
        text kind "day_pass | week | month | trial"
        int amount_minor
        char3 currency
        int usd_cents
        text source_kind "gym_website | price_menu | user | chat | scrape"
        text source_url
        date observed_on
        text verified_by "bot | admin | null"
        bool is_current
    }
    gym_source_refs {
        bigint gym_id FK
        text source "osm | google_maps | places | foursquare"
        text external_id
        timestamptz last_seen_at
    }
    requests {
        bigint id PK
        bigint user_id FK "null if signed out"
        text session_id "signed-out only"
        text kind "add_gym | update_gym | sweep | chat"
        text status "pending | completed | failed"
        timestamptz deadline
        text failure_reason
        jsonb input
        jsonb result
    }
    gym_changes {
        bigint id PK
        bigint request_id FK
        bigint gym_id FK "null for a new gym"
        jsonb proposed
        jsonb evidence "source_kind, url, observed_on"
        text review_status "pending_bot | awaiting_admin | approved | rejected"
        text decided_by "bot | admin"
    }
    tiles {
        text geohash PK "precision 5"
    }
    tile_fetches {
        text geohash FK
        text source
        timestamptz last_fetched_at
        text status
    }
    reviews {
        bigint id PK
        bigint gym_id FK
        bigint user_id FK
        smallint rating
    }
```

Better Auth adds its own `session`, `account` and `verification` tables next to `users`; they're not shown. pg-boss keeps its tables in a separate `pgboss` schema.

The sections below are the choices behind this diagram, each with variations.

### 2.3 Gym location

| Variation | Pros | Cons |
|---|---|---|
| `lat`, `lng` doubles (today) | Simple. | No spatial index; bounding-box and distance queries are hand-written and slow at scale. |
| **`geometry(Point, 4326)` + GIST index**, plus a generated `geohash5` column | Fast "in this tile / box" queries; `ST_GeoHash` gives the tile key; distance in metres by casting to `geography` when needed. | Needs PostGIS (available on RDS and in the `postgis/postgis` Docker image). |
| `geography(Point)` | Distances in metres natively. | Fewer functions and slower for box queries, which are our main query. |

**Recommendation: `geometry(Point, 4326)` + GIST, plus a stored `geohash5 = ST_GeoHash(location, 5)` column with a b-tree index.** Loading a tile becomes `WHERE geohash5 = $1`, which is about as cheap as a query gets, and it's the same key the CDN and Redis cache by.

### 2.4 Tile size (geohash precision)

| Precision | Cell size (approx.) | Pros | Cons |
|---|---|---|---|
| 4 | 39 × 20 km | Few cells per screen. | A big city in one cell = huge responses; Overpass queries for a whole cell get heavy. |
| **5** | **4.9 × 4.9 km** | A city-zoom screen (~zoom 12) needs ~6–12 cells; a busy cell has maybe 50–200 gyms, a few tens of KB. Small enough for one Overpass query or one sweep job. | More cells to request at low zoom, so we need a minimum zoom (already agreed). |
| 6 | 1.2 × 0.6 km | Tiny responses. | Dozens of requests per screen; many more cache keys; sweeps split into many small jobs. |

**Recommendation: precision 5, with the map loading gyms only at about zoom 11 and above.** Below that, show a "zoom in to see gyms" hint, or later a precomputed count per precision-3 cell.

### 2.5 Tile refresh and sweep status

| Variation | Pros | Cons |
|---|---|---|
| `fetched_areas` with bounding boxes (today) | Already exists. | Overlapping boxes, no fixed keys, can't tell which source fetched what. |
| One `tiles` row per cell with columns per source (`osm_fetched_at`, `gmaps_swept_at`, ...) | One row to read. | Adding a source means a schema change. |
| **`tile_fetches(geohash, source, last_fetched_at, status, gyms_found)`**, primary key `(geohash, source)` | Adding a source (Foursquare, Yandex in OOS-1) is just new rows. Overpass weekly refresh and Google sweeps are tracked separately. Seeding progress is "which tiles have a fetch for this source". | One more join (trivial). |

**Recommendation: `tile_fetches` keyed by `(geohash, source)`.** A `tiles` table only exists if we want per-tile extras later (e.g. a gym count for low zoom).

### 2.6 Prices and the verification rule

The approval rule needs to know **where** each price came from and **when** it was seen.

| Variation | Pros | Cons |
|---|---|---|
| Price columns on `gyms` (today: `day_pass_price_cents`, ...) | Simple, fast filters. | No source or date, so the "under a year old" rule can't be checked. No history. One currency only. |
| **`gym_prices` table** (one row per observed price: kind, amount, currency, `usd_cents`, `source_kind`, `source_url`, `observed_on`, `verified_by`, `is_current`) **plus current values copied onto `gyms`** | Full evidence for the rule. History of price changes. Original currency kept, USD snapshot for sorting. Map filters stay on the `gyms` row (no join per tile). | The copy on `gyms` must be updated when a price is approved (done in the same transaction). |
| `gym_prices` only, map filters join it | No duplicated data. | Every tile load joins and picks the latest price per gym; slower and more complex. |

**Recommendation: `gym_prices` history + current values copied onto `gyms` when approved.** The verification rule then reads straight from the evidence:

```mermaid
flowchart TD
    C[Proposed price change] --> W{source_kind =<br/>gym_website?}
    W -->|yes, bot found it there| A[Auto-approve<br/>verified_by = bot]
    W -->|no| M{source_kind = price_menu<br/>AND observed_on &gt;<br/>today - 1 year?}
    M -->|yes| A
    M -->|no| AD[awaiting_admin]
```

**Open sub-question for Joey:** for a price menu, what proves its date? Options: (a) a date printed on the menu that the bot reads, (b) photo metadata / upload date, (c) the date the user claims. Recommendation: (a) or (b); a user's claim alone goes to an admin.

### 2.7 Flexible gym details

| Variation | Pros | Cons |
|---|---|---|
| A column for every field | Fully typed and validated. | Opening hours, amenities, notes vary wildly; schema churn every time we learn a new fact type. |
| Everything in one JSONB blob | Maximum flexibility. | Filters and indexes get awkward; easy to store garbage. |
| **Hybrid**: columns for anything we filter or sort on (categories, drop-in, trial, current prices, status), JSONB `details` for the rest (opening hours in OSM `opening_hours` format, amenities, contact) validated by a Zod schema in `packages/shared` | Fast filters, flexible details, still validated. | Two places to look (minor). |

**Recommendation: hybrid.**

### 2.8 Categories

| Variation | Pros | Cons |
|---|---|---|
| Lookup table + join table (today: `categories`, `gym_categories`) | Classic, easy to rename labels. | Every tile query joins or aggregates. |
| **`text[]` column on `gyms` with a GIN index**, allowed values checked against a list in `packages/shared` (or a CHECK constraint) | One row = everything the map needs; `categories && $1` filter is indexed. | Renaming a category = an update over all gyms (rare). |
| Postgres enum array | Database enforces values. | Changing enums needs migrations, awkward with Drizzle. |

**Recommendation: `text[]` + GIN index.**

### 2.9 Text search (FR-10)

| Variation | Pros | Cons |
|---|---|---|
| **Postgres full-text (`tsvector` generated column, GIN) + `pg_trgm` for typos** (`pg_trgm` is already used) | No extra system; same query as the map filters. | Ranking is basic; multilingual stemming is limited (use the `simple` config). |
| OpenSearch | Great search, fuzzy, many languages. | Another paid service to run and keep in sync; overkill for filtering gyms in one view. |

**Recommendation: Postgres full-text + `pg_trgm`.**

### 2.10 Requests, changes and approvals (FR-16 to 18)

"My requests" shows add-gym, update-gym, sweep and chat requests together, each `pending / completed / failed`, and approvals/rejections. One sweep can find many gyms, and one chat can propose a few facts.

**Variation A: one `requests` table does everything** (kind, status, payload, review result)

```mermaid
flowchart LR
    R[requests<br/>kind, payload,<br/>status: pending, failed,<br/>awaiting_admin, approved, rejected...]
```

- ✅ Simplest; "My requests" is one query.
- ❌ A sweep that finds 30 gyms can't have 30 separate approvals; job status and review status get mixed into one column.

**Variation B: `requests` (the job) + `gym_changes` (each proposed change)**

```mermaid
flowchart LR
    R[requests<br/>what the user asked<br/>status: pending / completed / failed<br/>deadline, failure_reason] --> C1[gym_changes<br/>new gym A<br/>review: approved]
    R --> C2[gym_changes<br/>new gym B<br/>review: awaiting_admin]
    R --> C3[gym_changes<br/>price for gym C<br/>review: approved by bot]
    C3 --> P[gym_prices]
```

- ✅ Job lifecycle (did the bot run?) and review outcome (was the change accepted?) are separate, which is what the two decisions in PR #6 describe.
- ✅ Sweeps, chat facts and user submissions all produce the same `gym_changes`, so one approval flow and one admin queue (FR-12, FR-17).
- ✅ `gym_changes` doubles as the audit log of every change to every gym.
- ❌ "My requests" joins two tables (cheap).

**Variation C: separate tables per kind** (`gym_submissions`, `sweep_requests`, `chat_requests`)

- ✅ Each table has exactly its own columns.
- ❌ "My requests" becomes a UNION of several tables; status logic duplicated; the watchdog has to scan each.

**Recommendation: Variation B.** The user-facing status is derived: a request shows `failed` if its job failed, otherwise `pending` until all its changes are decided, then `completed` with counts ("3 gyms added, 1 rejected").

Review lifecycle of a `gym_changes` row, including the approval rule:

```mermaid
stateDiagram-v2
    [*] --> pending_bot
    pending_bot --> approved: bot verifies<br/>(gym verified, or price from website / menu < 1 year)
    pending_bot --> rejected: bot rejects junk / duplicate
    pending_bot --> awaiting_admin: not verifiable
    awaiting_admin --> approved: admin
    awaiting_admin --> rejected: admin
    approved --> [*]: applied to gyms (+ gym_prices) in one transaction,<br/>tile cache invalidated
    rejected --> [*]
```

Signed-out chat requests have `user_id = null` and a `session_id`, and a scheduled job deletes them after a day or so.

### 2.11 Deduplicating gyms across sources

Overpass, Google Maps and user submissions often describe the same gym.

| Variation | Pros | Cons |
|---|---|---|
| One ID column per source on `gyms` (today: `osm_id`) | Simple. | A new column per source. |
| **`gym_source_refs(gym_id, source, external_id, last_seen_at)`, unique on `(source, external_id)`** | Any number of sources; a refresh finds "our" gym by its external ID instantly; we can tell when a gym disappeared from a source (possibly closed). | One more table. |

Gyms without an external ID (user-submitted) are matched by distance + name similarity (`ST_DWithin` 50 m + `pg_trgm`), which the demo's `isDuplicateMatch` already does.

**Recommendation: `gym_source_refs`.**

### 2.12 Users and roles (FR-13, 14)

| Variation | Pros | Cons |
|---|---|---|
| Separate `admins` table (today) | Exists. | Admin = user, so two tables describe the same person. |
| **`role` column on `users` (`user` / `admin`)** | Simplest; Better Auth's admin plugin works this way. | Only one role per user (enough for us). |
| `roles` + `user_roles` tables | Many roles, fine-grained permissions. | Not needed for two roles. |

**Recommendation: `role` column.** Add a `moderator` value later if we need it.

### 2.13 IDs

| Variation | Pros | Cons |
|---|---|---|
| **`bigint` identity** | Small, fast indexes and joins; easy to read in logs. | Sequential IDs reveal counts (e.g. how many gyms); not an issue for public gym data. |
| UUID v7 | Can be created in the app; doesn't reveal counts. | Twice the size; harder to read. |

**Recommendation: `bigint` identity.** If we ever expose something sensitive by ID, give that table a UUID then.

### 2.14 Migrating from today's demo schema

The demo `db/schema.sql` is a hand-made dump. The plan is a fresh Drizzle schema plus a one-off script that copies demo gyms over: `lat/lng` → `location`, `osm_id` → `gym_source_refs`, price columns → `gym_prices` rows (`source_kind = 'scrape'` or `'osm'`, unverified), `gym_categories` → `categories[]`, `admins` → `users.role`. Demo reviews come along with `user_id` left empty.

---

## 3. Decisions needed from Joey

Recommendations in bold. Each can be changed in review.

**Stack**
1. Backend: **TypeScript + Fastify, monorepo with shared types**, or stay on Express?
2. Queue: **pg-boss (demo) + BullMQ on Redis (scale)**, or SQS for scale?
3. DB access: **Drizzle**, or Prisma / Kysely?
4. Auth: **Better Auth (users in our Postgres)**, or Cognito?
5. Demo hosting: **Lightsail 4 GB + Docker Compose + S3/CloudFront** (~$24/month), or EC2 + RDS (~$30–45)?
6. Ollama in demo: **Joey's PC through a tunnel**, small CPU model on the box, or a GPU instance (~$400+/month)?
7. Scale hosting: **ECS Fargate + RDS + ElastiCache, built with CDK**?
8. Map: **MapLibre + Protomaps on S3**, or keep Leaflet with a paid tile provider?
9. Scraper: **Playwright in sweep workers, proxies only if blocked**?

**Schema**
10. Gym location: **PostGIS point + generated `geohash5`**, and tile size **precision 5** with a minimum zoom of about 11?
11. Prices: **`gym_prices` history with source + date, current values copied to `gyms`**? And how a price menu's date is proven (**printed date or photo date; a user's claim alone goes to an admin**)?
12. Requests: **Variation B, `requests` + `gym_changes`**?
13. Smaller ones, fine to accept as a group: hybrid columns + JSONB details, `text[]` categories, Postgres full-text search, `gym_source_refs`, `role` column, `bigint` IDs.

Once these are settled, the next doc is the API (endpoints, tile URLs and cache headers, request polling).
