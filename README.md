# TravelApp

An all-in-one travel app. Built on TypeScript, React Native (Expo), PostgreSQL, and eventually AWS.

## Gym Finder

For broke backpackers: find gym trial hacks and the cheapest nearby walk-ins, anywhere in the world, weighted toward backpacker and digital-nomad hubs - search any city, no fixed destination list. At its core, it finds all nearby gyms with OpenStreetMap; click a gym to ask a bot for details on cost, free trials, etc., and that gets stored into a database. See [docs/gym-data-design.md](./docs/gym-data-design.md) for how gym data is sourced, and [Plan.md](./Plan.md) for the full design.

Demo: https://photos.app.goo.gl/GRBmorkgwwYUKwzo6

---

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Set up the database (Postgres - see [Database setup](#database-setup) below if you don't have this running yet)

   ```bash
   createdb travelapp
   psql -d travelapp -f db/schema.sql
   psql -d travelapp -f db/seed.sql
   ```

3. Set up your `.env`

   ```bash
   cp .env.example .env
   # then edit .env and fill in ANTHROPIC_API_KEY (needed for the "Ask me
   # questions about this gym" chat feature) and JWT_SECRET (signs login
   # session tokens - any long random string works, .env.example shows
   # how to generate one)
   ```

4. Start the backend API server (in one terminal, stays running)

   ```bash
   node server/index.js
   ```

5. Start the app (in another terminal)

   ```bash
   npx expo start
   ```

### Database setup

Needs a local Postgres server running. On macOS with Homebrew:

```bash
brew install postgresql@16
brew services start postgresql@16
```

Then run the three commands in step 2 above. `db/schema.sql` is a full schema dump (tables, the `gym_data_source` enum, indexes, foreign keys, the `pg_trgm` extension used for gym-name duplicate matching); `db/seed.sql` adds the couple of reference rows the app actually needs to run (submission status labels, the bot's sentinel admin row) - it does *not* seed any gym data. Gyms populate live the same way they do for everyone: search a city and the server pulls real gyms from OpenStreetMap on the fly.

If your Postgres setup needs a specific host/user/password (not just your local default), set the standard `PGHOST`/`PGUSER`/`PGPASSWORD`/`PGPORT` environment variables - `server/index.js` doesn't hardcode a connection beyond the database name, so it picks those up automatically.

### Accounts and admins

Signing up (email+password only for now - Google/Facebook sign-in need real OAuth app credentials from each provider before they can be built) is only required for adding a gym or suggesting an edit. Anyone can apply to become an admin from their profile page, but approving that first application needs an existing admin - there isn't one yet on a fresh database. Bootstrap the first admin directly in Postgres after signing up once in the app:

```bash
psql -d travelapp -c "UPDATE users SET is_admin = true WHERE email = 'you@example.com';"
psql -d travelapp -c "INSERT INTO admins (id, name) SELECT id, name FROM users WHERE email = 'you@example.com' ON CONFLICT (id) DO NOTHING;"
```

From there, that admin can approve everyone else (including other admin applications) from `/admin` in the app. Approval/denial emails and the "post to Facebook on signup" hook are both stubbed for this demo - they log what they would have sent/posted to the server console rather than actually sending, since real email delivery needs a provider+API key and real Facebook posting needs Meta App Review on a registered app, neither of which exists here.

### Local AI (free, for development)

The chat/research/edit-verification features normally call the real Anthropic API, which costs real money per request. Set `AI_PROVIDER=ollama` in `.env` to run a free local model instead while developing:

```bash
brew install ollama
brew services start ollama
ollama pull qwen2.5:3b   # or whatever OLLAMA_MODEL is set to in .env
```

This is a genuine tradeoff, not a free upgrade: a small local model is noticeably less reliable than Anthropic's hosted one at actually calling the right tool with the right data (expect more "found a price but didn't record it"-type misses), and it has no real web search of its own - `server/ai.js` gives it a DuckDuckGo-HTML-scraping tool to stand in for Anthropic's hosted search, which works but is an unofficial surface that could break if DuckDuckGo changes their markup. Flip `AI_PROVIDER` back to `anthropic` (or just unset it) for anything you want to trust, including production.

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **src/app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **example** directory and create a blank **src/app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
