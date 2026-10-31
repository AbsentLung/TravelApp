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
- Split the map into fixed geohash cells. Load the cells on screen as the user pans/zooms, and only above a minimum zoom.
- Refresh stale cells from Overpass (about weekly), using `last_fetched`.
- Saved/submitted gyms are written to Postgres immediately (never only to cache).
- Redis is included now as a cache layer in front of Postgres (e.g. Upstash free tier). Access it only through a small cache interface so the provider can change.

### LLM
- The app uses Ollama (local/open models) for now to save money.
- Keep every LLM call behind one interface so it can switch to Claude once the app makes money. No provider-specific calls outside that module.

### Hosting
- AWS (decided by Joey 2026-10-31; replaces the earlier Netlify + GCP e2-micro idea).
- Demo mode stays near-free on a single small instance; scale mode moves to managed AWS services. Concrete services are being decided in STACK_AND_SCHEMA.md.
- Keep config in env vars and keep AWS-specific code behind interfaces, so services can be swapped.
