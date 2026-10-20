# Gym Finder

A way to find gyms anywhere in the world, weighted toward the places backpackers and digital nomads actually go (Bali/Canggu, Chiang Mai, Lisbon, Medellín, Mexico City, Bangkok, etc.) rather than even global coverage. This doc is about one question: **where does the gym data come from?**

## The options

### 1. Official map/places APIs (Google Places, Foursquare, OpenStreetMap/Overpass)

**Pros**
- Legally clean — licensed, ToS-compliant, no scraping exposure at all. Given everything we just discussed about Air Canada v. Seats.aero and American v. Skiplagged, this matters more than it might look like on a feature list.
- Structured data for free: name, address, coordinates, phone, hours, rating, photos. No parsing/normalization work.
- Google Places specifically has a `gym` place type and genuinely good global density, including in most nomad hubs.
- OpenStreetMap is free (no per-request cost) and has `leisure=fitness_centre` tagging. Coverage is volunteer-driven, but several nomad hubs in Southeast Asia have surprisingly active OSM communities.

**Cons**
- Cost: Google Places isn't free at any real scale. Refreshing a worldwide gym dataset periodically adds up fast under per-request billing.
- Missing exactly the attributes that matter most to this audience: day-pass price, whether drop-ins are even allowed, equipment/specialty (CrossFit vs. commercial chain vs. climbing gym), wifi, long-stay packages. No map API has any of this.
- Storage/caching restrictions in some API terms — worth checking current Google Maps Platform ToS before architecting "store everything forever."
- Single-vendor pricing risk. Google has changed Maps API pricing substantially before, and it broke a lot of startups' unit economics overnight.

### 2. User-submitted / crowdsourced data

**Pros**
- This is the richest possible source for the attributes that actually differentiate the app — day-pass pricing, drop-in policy, "is this nomad-friendly," real photos, recency ("verified by someone this month").
- The target audience is already a community that shares exactly this kind of info (r/digitalnomad, Nomad List, city-specific Facebook/WhatsApp groups) — crowdsourcing taps a motivated base rather than fighting against apathy.
- Zero marginal cost per record, and a flywheel: more users → better data → more users.
- No legal exposure — it's first-party data people willingly contribute about places they visited.

**Cons**
- Classic cold-start problem: an empty map on day one gets zero contributions, because there's nothing to anchor interaction around.
- Coverage will be wildly uneven early on — popular hubs fill in fast, most of the world stays blank for a long time.
- Needs real moderation: fake entries, stale info, spam. Requires at minimum an upvote/downvote system and a "last verified" timestamp, which is its own build.

### 3. Scraping Google Maps / gym websites directly

**Pros**
- Could theoretically pull richer data than any official API exposes (review text, popular-times graphs, pricing listed on a gym's own site).
- No per-request billing line item.

**Cons**
- This is the exact pattern we spent the last hour establishing is a real, demonstrated legal problem — not a hypothetical one. Google's own ToS explicitly prohibits automated/bulk extraction, and it's been enforced. Doing this as the backbone of a commercial product is the same shape as the Seats.aero/Skiplagged/Kiwi.com cases, not a smaller version of them.
- Technically fragile in the same way `aa.com` 403'd a single plain fetch earlier today — Maps has serious bot detection, and scraped structure breaks whenever Google changes markup.
- I'd steer away from this as a primary strategy for the same reasons already laid out for the airline-miles idea. Happy to revisit narrowly (e.g., a one-time, rate-limited, personal-use pull) if there's a specific gap this is meant to solve that nothing else covers — but not as the main data pipeline.

## Recommendation: seed with an API, enrich with users, skip scraping as the backbone

1. **Seed layer — OpenStreetMap first, Google Places to fill gaps.** Pull baseline gym *locations* (name, address, coordinates) for a short list of launch cities, not the whole world. OSM is free and already decent in several nomad hubs; fall back to Google Places API only where OSM is thin, to control cost. This solves the empty-map cold-start problem on day one, legally and cheaply.
2. **Enrichment layer — user check-ins and edits on top of the seed.** This is where the actual product value lives: day-pass price, drop-in policy, wifi, crowd level, photos, "visited and verified" badges. Map APIs will never have this; your users are the only real source for it.
3. **Later — let gyms claim their own listing.** Once there's real traffic, a "claim this gym" flow (gym owner self-reports pricing/hours, similar to Google Business Profile) solves the verification problem *and* gives gym owners a reason to want to be listed — visibility to a traveling customer base they don't otherwise reach. Possible monetization angle down the line (featured placement), but that's a later conversation.
4. **Start narrow.** Launch with 5-8 known nomad-dense cities rather than "the whole world" — makes the cold-start problem tractable and lets the data model get validated before scaling out.

## A couple of technical notes for later

- Postgres has **PostGIS**, which is the right tool for "gyms near me" geospatial queries — worth enabling from the first migration rather than bolting on distance math later.
- Every enriched field (price, hours, drop-in policy) should carry a `last_verified_at` timestamp from day one, so the UI can show "confirmed 2 weeks ago" vs. "nobody's checked this in 8 months" — that distinction is probably more valuable to a traveler than the raw data point itself.
