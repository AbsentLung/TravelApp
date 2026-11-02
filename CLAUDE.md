# CLAUDE.md

Gym Finder (TravelApp): helps budget backpackers find nearby gyms, free trials and the cheapest walk-ins.

Expo/React Native rules (SDK version, commands, routing, EAS) live in AGENTS.md:

@AGENTS.md

## Project decisions

These were agreed with Joey. Follow them unless he changes them; update this file when he does.

### Platforms and scale
- Ship on Web, Android and iOS from one Expo codebase. Prefer shared cross-platform code; use `.web.tsx` / platform files only when a platform truly needs it.
- Must scale to thousands of users later. Avoid single-server shortcuts (in-memory state, local files as storage, per-process caches as the source of truth). Keep backend services stateless.

### Location search
- Use the Photon geocoder (photon.komoot.io) with search-as-you-type (debounce requests).
- Never use the public Nominatim server in production.

### Gym data
- Fetch gyms from the Overpass API (`leisure=fitness_centre`) and merge them with user-submitted gyms.
- Postgres + PostGIS is the source of truth: gyms, user-submitted gyms, and `last_fetched` per area.
- The app calls our backend, not Overpass directly.

### Caching and loading
- Split the map into fixed geohash5 cells. Load the cells on screen as the user pans/zooms, only at zoom 11 and above (same as `FILTERS_VISIBLE_AT_ZOOM = 11` in the vibe-coded map). Below zoom 11: no tile requests, nothing cached, no gym pins, no filters.
- Refresh stale cells from Overpass (about weekly), using `last_fetched`.
- Saved/submitted gyms are written to Postgres immediately (never only to cache).
- Redis (ElastiCache) is the cache and BullMQ queue in scale mode; demo mode uses an in-memory cache and a pg-boss queue in Postgres. Access both only through small cache and queue interfaces.

### LLM
- The app uses Ollama (local/open models) for now to save money.
- Keep every LLM call behind one interface so it can switch to Claude once the app makes money. No provider-specific calls outside that module.
- Chats are temporary: never store chat questions or answers in Postgres or logs. Answers live in the cache for ~15 minutes only. Facts found by chat may be proposed as gym changes for review.

### Map filters
- Keep the filters exactly as in the vibe-coded map (`GymFinderVibeCoded` branch): text search (name, description, address, categories), drop-ins only, trials only, category dropdown, all client-side on loaded tiles. No price filter.
- Right sidebar day-pass list: cheapest first, unverified prices at the bottom.

### Hosting
- AWS (decided by Joey 2026-10-31; replaces the earlier Netlify + GCP e2-micro idea).
- Demo mode stays near-free on a single small instance; scale mode moves to managed AWS services. Demo: Lightsail + Docker Compose, S3 + CloudFront + Route 53. Scale: ECS Fargate, RDS Postgres, ElastiCache, AWS CDK. See STACK_AND_SCHEMA.md.
- Keep config in env vars and keep AWS-specific code behind interfaces, so services can be swapped.

### Stack and schema (decided 2026-11-01/02, details in STACK_AND_SCHEMA.md)
- TypeScript everywhere: Fastify API + workers, npm-workspaces monorepo, Zod schemas shared with the app. Drizzle ORM + migrations. Better Auth (users in our Postgres).
- Map: MapLibre with self-hosted Protomaps tiles. Never use the public OSM tile servers in production.
- Scraper: Playwright in sweep workers. Never pay for proxies or scraping APIs.
- Schema: PostGIS point + GIST + `geohash5` tiles; `tile_fetches`; `gym_prices` (current verified + unverified price per kind, no history, `last_seen_at`); `requests` + `gym_changes`; `gym_source_refs`; `users.role`; bigint IDs.
- Price verification: web price = verified; Google Maps menu photo posted < 1 year ago = verified; otherwise admin.
- Unverified prices are stored too (`verified_by` empty, at most one verified + one unverified row per gym per kind) and shown below verified ones; an admin approving one makes it the verified row.
