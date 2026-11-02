# Gym Finder Requirements

Phase 1 of the [roadmap](https://github.com/AbsentLung/TravelApp/blob/main/README.md#roadmap). This doc says **what** Gym Finder must do, not **how**. Tool and API choices (map library, database, hosting, LLM, etc.) are decided in phase 2 (Design), so they are left out here on purpose. The only named services below are ones that are part of the requirement itself.

Each requirement has an ID so later docs (`DESIGN.md`, PRs, tests) can point at it.

## Functional requirements

### Home page

- **FR-1** The home page lets a user start by either searching for a location (city, area, address) or using their current location.
- **FR-2** Choosing either option takes the user to the map, centered on that location.
- **FR-3** If the user declines location permission, the app still works through search.

### Map

- **FR-4** A traversable map (pan and zoom) that shows every gym in the world that our data sources know about.
- **FR-5** Gyms load for the area the user is looking at as they move around the map.
- **FR-6** Selecting a gym on the map opens its details.

### Gym details

- **FR-7** A gym's details include, where known: name, location, costs (drop-in / day pass, trial, membership), description, category, and opening hours.
- **FR-8** The details section includes an AI chatbot that looks up and answers questions about that specific gym's data (e.g. "is there a free trial?", "how much is a day pass?").
- **FR-9** Useful facts the chatbot finds can be saved to the gym's record so the next user sees them without asking again (subject to FR-17).

### Filtering and search

- **FR-10** Users can filter the gyms shown in the current map view by:
  - drop-ins allowed
  - trial hacks (free or cheap trial offers)
  - gym category (e.g. commercial, CrossFit, climbing, martial arts, yoga)
  - a text search over gym details

### Area sweeps by bot

- **FR-11** Beyond free data sources, a user can request that a bot sweeps an area on Google Maps to find gyms that are missing from the map.
- **FR-12** Gyms found by a sweep go through the same approval flow as user submissions (FR-16, FR-17).
- **FR-22** If the user is signed in, each sweep request and its status (pending, completed, failed) is saved, and shown on the same page as their add/update gym requests (FR-18).
- **FR-23** Users are told when their sweep request fails.

### Accounts and roles

- **FR-13** Users can sign up, log in, and log out.
- **FR-14** Some users are recognized as admins.
- **FR-15** Browsing the map and viewing gym details do not require an account. Submitting or requesting changes does.

### Adding and updating gyms

- **FR-16** Logged-in users can request that a gym be added to the map, or that an existing gym's details be updated.
- **FR-17** Each request is reviewed first by a bot. If the bot can verify it (FR-24), it goes live without admin approval. Otherwise it waits for an admin to approve it.
- **FR-18** Users can see the status of their requests (pending, approved, rejected).
- **FR-24** A price change counts as bot-verified if the bot finds the new price on the gym's own website, or in a price menu that is less than a year old.

### Pre-seeding gym data

- **FR-19** A script populates all gyms in a given area (e.g. a city or a bounding box), so the map already has data there before any user visits.
- **FR-20** Before release, the script is run on the most popular travel destinations, so launch users don't land on an empty map.
- **FR-21** The script can be re-run on an area without creating duplicate gyms, so seeded data can be refreshed.

## Non-functional requirements

- **NFR-1 Users:** expect 10,000 daily active users.
- **NFR-2 Bot load:** expect up to 1,000 bot requests per second.
- **NFR-3 Platforms:** Web, Android and iOS.
- **NFR-4 Growth:** the design can scale past these numbers without a rewrite.

## Out of scope (for now)

- **OOS-1 Regional map sources:** the sweep bot uses the best map source for each region, e.g. Yandex Maps in post-Soviet countries and Baidu Maps in China, choosing automatically from the location being swept.
- **OOS-2 Premium:** a paid premium version.

## Open questions

These are flags for the research step in phase 1, not changes to the requirements above.

1. **Google Maps sweeps (FR-11) and its Terms of Service.** Google Maps' terms forbid scraping its data, and courts have sided with companies against scrapers before (see [Plan.md](./Plan.md)). This could get the app blocked or sued. Is there a licensed way to get the same result, or should sweeps be limited or dropped? OOS-1 raises the same question for Yandex and Baidu.
2. **What is a "bot request" in NFR-2?** 10,000 daily users making, say, 20 requests each is about 2-3 requests per second on average, maybe 10-30 at peak. 1,000 per second is about 86 million a day, which is far more than 10k users would create. If it means chatbot messages, that rate of LLM calls would be very expensive, and well beyond a local model. If it means sweep requests to a map site, that rate would get blocked quickly. Which bot, and is 1,000/s a peak or a sustained rate?
3. **"Every gym in the world" (FR-4).** Coverage can only be as good as the data sources plus user submissions. Is it acceptable that some regions start sparse?
4. **Bot approval (FR-17).** Price changes are covered by FR-24. What counts as bot-verified for other changes (a new gym, opening hours, category), and what may the bot reject on its own (spam, duplicates, missing fields)? How does the bot tell a price menu's date?
5. **Chatbot sources (FR-8).** Where is the chatbot allowed to look up gym data (our database only, the gym's own website, the open web)? This affects cost, accuracy, and legal exposure.
6. **Filter scope (FR-10).** Read here as "filter what's in the current map view". Should search also find gyms outside the view?
7. **Which destinations to pre-seed (FR-20)?** Who picks the list, and how many cities? A fixed list we write ourselves is simplest; a ranking from published tourism data is more defensible. Pre-seeding should stick to sources we're allowed to store (see question 1).
