# Gym data design

Decisions for how TravelApp finds locations and sources gym data. These supersede the equivalent pieces of `Plan.md` (noted inline there) — this doc is the one to follow when building.

1. **Location search: Photon (`photon.komoot.io`) for search-as-you-type.** Not Nominatim's public server in production — it's rate-limited to 1 req/sec and has no autocomplete support, both disqualifying for a type-ahead search box.

2. **Gym data: Overpass API (`leisure=fitness_centre`, scoped to the selected area), merged with user-submitted gyms.** Same source already in use for the initial Bali seed — this generalizes it to work for any area a user searches, not just one pre-configured city.

3. **Storage: Postgres + PostGIS is the source of truth.** Stores OSM-sourced gyms, user-submitted gyms, and a `last_fetched` timestamp per area.

4. **On lookup: serve from Postgres.** If the area has never been fetched, or `last_fetched` is older than ~1 week, refresh from Overpass and merge before serving.

5. **Saving a gym writes to Postgres immediately** — no write-behind, no batching.

6. **Redis is deferred to production**, added later as a cache layer in front of Postgres. Not built now.

## Supersedes in `Plan.md`

- **Redis**: `Plan.md`'s "Caching gym metadata with Redis, designed for scale now" section decided to build Redis immediately, at full scale. Decision 6 above reverses that — Redis is deferred until production. `Plan.md` is left as-is (the reasoning for *why* Redis would look like that when it's eventually built is still valid), but it no longer reflects the current build order.
- **Keeping the OSM seed fresh**: `Plan.md`'s "Keeping the OSM seed fresh" section decided on BullMQ-scheduled polling every 15 minutes, per a small fixed list of launch cities (`launch_cities`). Decision 4 above replaces that with a lazy, per-area, on-lookup staleness check instead of a scheduled job. This isn't a minor tweak — it's a different mechanism driven by a different reality: once location search (decision 1) lets someone search *any* area, there's no fixed city list left to schedule against. The per-area `last_fetched` check is a strict generalization that also covers Bali itself (it's just "an area," fetched lazily like any other) — no separate scheduled job needed alongside it.

## Considered and rejected: populating `gyms` only when a pin is clicked

**The question:** since storage growth from fetch-as-you-pan felt like it could get out of hand, would it be better to never persist a gym from an area fetch at all — hold just title + coordinates in memory while panning/zooming, and only write a real `gyms` row the moment someone actually clicks a pin?

**Rejected.** The underlying worry turned out to be about the wrong resource — a lean row (name + coordinates) per real-world gym is cheap at any plausible scale; Postgres doesn't strain under millions of rows like that, and the row count is bounded by how many gyms actually exist, not by how far anyone pans. What's genuinely scarce is Overpass's fair-use rate limit, and persisting pins on fetch (decisions 3–4 above) is exactly what protects it — `fetched_areas` means a popular area only gets fetched from Overpass roughly once a week, no matter how many people search it. Click-only materialization would remove that protection entirely: every search of an already-seen area, by anyone, would re-hit Overpass, which would blow through the fair-use budget almost immediately under any real traffic.

It would also break things already built: `allows_drop_in`/trial/pricing only ever arrive via a user edit targeting an existing `gyms.id`, so the drop-in filter and the day-pass price list could only ever surface gyms someone had already individually clicked — at launch, that's effectively nothing. On top of that, the bot sweep's local duplicate check queries `gyms` directly; anything not yet materialized would be invisible to it, weakening duplicate detection for exactly the gyms most likely to need it (ones nobody's touched yet). And it would mean maintaining two sources of truth for "what's in this area" — an ephemeral in-memory list and the real table — needing a live merge/dedupe on every render, which directly contradicts decision 3 above (Postgres is the source of truth).

**If bounded long-term growth is still a real goal**, the way to get it without those costs is a periodic cleanup job pruning `gyms` rows with no reviews, no edits, and no clicks in a long time (6–12 months, say) — not refusing to cache in the first place. Not built now; noted as the right lever if this ever needs revisiting.

## Two refresh mechanisms, not one, doing two different jobs

**Decided: the lazy per-area refresh (decision 4) and a new daily rotating coverage job are complementary, not alternatives.** They're solving different problems:

- **Lazy per-area refresh** (already built) keeps *popular* areas fresh automatically — it's demand-driven, so an area that gets searched often naturally gets refreshed often (whenever it goes stale, the next real lookup triggers the update), with zero schedule to maintain.
- **Daily rotating coverage job** (new) gradually seeds areas *nobody's searched yet* — population centers nothing's pointed a search at. Without it, those areas would sit permanently unfetched; the lazy mechanism only ever fires in response to a real lookup, so it can't proactively reach anywhere.

**Decided: the coverage job budgets itself to stay comfortably under Overpass's fair-use guidance, and reuses `fetched_areas` as its only state.** It walks a fixed 10°×10° grid over the whole world (648 cells), skips any cell that already has a fresh covering entry in `fetched_areas` (whether that freshness came from a real user search or a previous day's coverage run — same table, same staleness rule, no special-casing), and stops once it's made ~80 real Overpass calls for the day — leaving headroom under the ~100/day guidance rather than running right up against it. At that pace, full first-pass coverage of the world takes roughly a week; a cell that fails (timeout, 502 — a real, expected outcome, not exceptional) simply stays non-fresh and gets retried on a later day, or sooner if someone happens to search it directly in the meantime.

No new tracking table — `fetched_areas` already answers "is this covered and how recently," regardless of which of the two mechanisms did the covering.

## Open question this doc doesn't answer yet

A 1-week-stale area being refreshed synchronously on the lookup that discovers it means that *specific* request waits on a live Overpass round-trip. `Plan.md`'s "waiting room" pattern (poll every ~2s, give up after ~30s) was designed for a different scenario (a Redis cache-stampede on gym detail lookups) but is the obvious candidate to reuse here — worth confirming before building the refresh path, not guessing at silently.
