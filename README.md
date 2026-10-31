# I am currently working on a Gym Finder app.
For reference: https://github.com/AbsentLung/TravelApp/tree/GymFinder
Demo: https://photos.app.goo.gl/GRBmorkgwwYUKwzo6

This app is intended for broke backpackers to find gym trial hacks, and the cheapest nearby walk-ins.
At its core, it finds all nearby gyms with Open Street Maps. When you click on a gym, you can then ask a bot for details about costs, free trials, etc. and that data is then stored into a database.


# Roadmap

Each phase finishes before the next one starts, unless noted. Check items off as they're done.

## 1. Requirements

- [ ] List functional requirements
- [ ] List non-functional requirements (performance, scale to thousands of users, cost, privacy, offline behavior)
- [ ] List the riskiest unknowns (e.g. limits of whichever map/gym data source we pick, cost and hosting of the chatbot's LLM, moderating user-submitted gym data)
- [ ] Ask Claude to research whether the requirements and unknowns are realistic
- [ ] Decide what's in scope for beta / demos and what's saved for later

## 2. Design

Expo (SDK, Expo Router, TypeScript) is already in the repo, so treat it as a constraint going in.

- [ ] High-level design: ask Claude for several options with pros and cons, debate until we land on the best one
- [ ] Choose everything Expo doesn't cover, driven by the high-level design: where the backend runs (e.g. Expo API routes or a separate server), database, cache, hosting, the map and gym data source, and the chatbot's LLM
- [ ] Database schema: ask Claude for several variations, debate until we land on the best one
- [ ] API design: compare variations and their trade-offs, then approve a final design
- [ ] Clean up into a presentable `DESIGN.md` for others to read
- [ ] Update `CLAUDE.md` (drafted in [PR #1](https://github.com/AbsentLung/TravelApp/pull/1)) so Claude stays on track and builds things the way we planned

## 3. Environment

- [ ] Separate dev, staging and production setups, with secrets kept out of the repo
- [ ] Local database and cache (whatever phase 2 picks) running via Docker, one command to start
- [ ] Install packages
- [ ] Linting, formatting and test frameworks (unit, integration, end-to-end) set up before any feature code
- [ ] CI/CD pipelines (lint, type-check, tests on every PR; deploys per environment)
- [ ] GitHub branch protection, so nothing merges without the required reviews and green checks
- [ ] Error tracking and logging

## 4. Build

Every section ships with unit, integration and automated tests, and runs on **web, Android and iOS** as it's built (Expo gives us all three from one codebase).

Review gate for every section:
- CodeRabbit approval
- Second Claude approval
- Human approval

Steps:
- [ ] Walking skeleton, end to end: search a city → fetch nearby gyms from the chosen data source → cache them → show them on the map
- [ ] Routing
- [ ] Initial frontend and backend structure built out from the skeleton
- [ ] Features, one at a time:
  - [ ] The map
  - [ ] Homepage
  - [ ] Find by search
  - [ ] Find by current location
  - [ ] Filters
  - [ ] Individual gym sidebar
  - [ ] "Find More Gyms"
  - [ ] Individual gym chatbot
  - [ ] Anything else that came up in phases 1 and 2
- [ ] Polish for mobile web, Android and iOS specifics

## 5. Release

- [ ] Start the Google Play closed test early (new personal accounts need 12 testers for 14 days before going public)
- [ ] Buy an Apple Developer account ($99/year)
- [ ] Write a privacy policy
- [ ] Add OpenStreetMap attribution in the app (required by its license)
- [ ] Prepare store listings (Google Play and App Store)
- [ ] Buy the cheapest possible environment for a demo release on web and Android
- [ ] Test everything thoroughly and keep fixing things until we're ready to leave beta
- [ ] Once iOS is thoroughly tested, release the beta to the App Store
- [ ] Confirm web, mobile web, Android and iOS all work correctly
- [ ] Buy all resources needed for the full release
- [ ] Deploy final versions


# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

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
