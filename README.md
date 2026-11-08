# Movie Night Matcher

A responsive React app for deciding what to watch together. Create a room, share an invite, vote yes or pass, and find the films **every member** wants to watch. Check subscription, rental, and purchase options by country when TMDB is connected.

**Frontend:** https://yis4u.github.io/movie-night-matcher/

The frontend works without credentials in a clearly labeled local demo. Real cross-device rooms require the Firebase backend below. This repository retains its initial commit and adds the app on top of that history.

## Run locally

Use Node.js 22 and npm. Dependencies are locked in both package lockfiles.

```sh
npm ci
npm run dev
```

Open the printed `/movie-night-matcher/` URL. To inspect the production build:

```sh
npm run build
npm run preview
```

## What works in the demo

- A cinematic discovery screen with original hero artwork, spotlight navigation, mood collections, search, genre/runtime filters, and sorting.
- A personal **shortlist** saved on this browser, plus an explicit film lineup you can build before creating a room. Select up to 20 films; changing discovery filters preserves your lineup.
- **Surprise me** picks a film from the currently visible results; it never claims to provide AI recommendations.
- Create and join rooms, preview the exact voting deck, share invite codes, vote by buttons/swipe/keyboard, review votes, and discover unanimous matches.
- Live crew progress and an accessible match celebration for newly unanimous films. Existing matches are not announced again when reopening a room; reduced-motion preferences are respected.
- Updates between tabs in the **same browser** using local storage and storage events. A new tab has its own demo voter identity.
- Optional **Add a demo friend** adds Alex with explicitly simulated votes. No simulated people join automatically.
- Film details and country selection. Streaming lookup is explicitly unavailable until the TMDB backend is connected; no provider offers are fabricated.

Demo rooms and votes persist in this device’s local storage. They are **not private**, are not shared between browsers or devices, and may be cleared with browser site data. Guest voter identity lasts for that tab’s session. Movie posters load from TMDB’s public image CDN, with original SVG illustrations as offline/error fallbacks. The cinematic hero is original generated artwork, not a still from a featured film. Sample ratings are fixed snapshots, not live ratings. Actual room matches are computed from votes.

## Connect Firebase and TMDB

GitHub Pages serves static files. **It cannot run server code or keep secrets.** This project supplies Firebase Authentication, Firestore, and Node.js 22 Cloud Functions. The Functions backend needs a Firebase project on the **Blaze plan**, enabled billing, and appropriate Google Cloud APIs; usage may incur costs. No paid backend has been provisioned by this repository.

1. Create a Firebase project and a web app. Create a Firestore database. Keep its default rules restrictive; deploy this repository’s rules before use.
2. In **Authentication → Sign-in method**, enable **Anonymous** authentication. Optionally enable **Google**. Add `yis4u.github.io` and your local development host to Authentication’s authorized domains. Do not add the repository path to the domain.
3. In **App Check**, register the web app using reCAPTCHA v3 and allow `yis4u.github.io`. Record its **public site key**. Cloud Functions enforce valid App Check by default. Also enable App Check enforcement for Firestore in the console after verifying your setup.
4. Copy `.env.example` to `.env.local` and fill in the four public Firebase web config values and public App Check site key. The region defaults to `us-central1`, matching the supplied Functions. Missing or partial configuration keeps the frontend in labeled local demo mode.
5. Obtain a TMDB API **Read Access Token** from your own TMDB developer account. Store it in Firebase Secret Manager using the interactive prompt, never in a frontend variable:

   ```sh
   npm ci --prefix functions
   npx firebase login
   npx firebase functions:secrets:set TMDB_READ_TOKEN --project YOUR_PROJECT_ID
   ```

6. Deploy the backend and rules:

   ```sh
   npx firebase deploy --only functions,firestore:rules,firestore:indexes --project YOUR_PROJECT_ID
   ```

   Accept the default `ENFORCE_APP_CHECK=true`. Only local emulators should set this to false. Functions allow this GitHub Pages origin and localhost. If hosting under a different owner/domain, edit the explicit CORS allowlist in `functions/index.js`. No TMDB token is sent to the browser.

7. Set `VITE_TMDB_ENABLED=true` **after** the TMDB Functions and secret are deployed. Firebase rooms can be live while using the labeled sample catalog with this flag false.
8. For GitHub Pages, add the same **public** `VITE_*` settings as repository **Settings → Secrets and variables → Actions → Variables**. Push a commit or run the Pages workflow again. They are build-time settings; rebuilding is necessary for changes.

Firebase web configuration and the reCAPTCHA site key are designed to be public. Restrict the Firebase web API key to the intended APIs and approved web origins. Access control comes from Authentication, App Check, and the Firestore rules, not secrecy of Firebase’s web API key.

**Never add TMDB*READ_TOKEN, Firebase Admin/service-account keys, OAuth client secrets, or any private token to a `VITE*\*` variable.** Vite embeds all such variables in public JavaScript. `.env*`, service secret files, build outputs, and dependencies are ignored. The Pages workflow uses only public repository variables and the workflow’s short-lived deployment identity. Firebase deployment stays an explicit administrator operation; no Firebase service-account credential is stored in GitHub.

### Backend behavior and access rules

- Firebase guests receive real anonymous auth identities. Optional Google sign-in links a new account to the guest when possible. Signing into an existing Google account switches identity; previous guest rooms do not automatically migrate. Sign in before creating rooms for cross-device access.
- Room creation and joining go through authenticated, App Check protected callables. Eight-character random codes act as invite capabilities: **treat them as private**. Joining adds your authenticated UID on the server. Rooms are capped at 12 members and 20 films.
- Room documents and vote lists are readable only by room members. The My rooms query is constrained by `memberIds array-contains uid`; arbitrary room enumeration is denied.
- Clients cannot create rooms directly, edit membership, change decks, alter host identity, write another user’s votes, or write arbitrary server documents.
- A vote must target a film in the room, contain only the allowed fields, use the voter’s UID and matching document ID, have a yes/no choice, and use a server timestamp. Closed rooms reject further votes.
- Only the host can end a room. Ended rooms remain available to members with their final matches. This version has no client deletion, kicking, or expiry feature; administrators can remove old rooms and their vote subcollections using trusted tooling.
- A shared match requires at least two members and **every current member’s yes**. New members must vote too; a majority and an uncast vote never count. Vote changes recompute matches immediately.
- TMDB requests use a fixed server-side API host and allowlisted inputs/endpoints. Authentication, App Check, per-user transactional request limits, a bounded five-minute cache, timeouts, and a maximum instance count reduce abuse and resource use. `_rateLimits` is private server data. Apply project quotas/budget alerts appropriate to your audience.
- Provider offers are looked up for the selected country and grouped into subscription, rent, and buy. Missing results are treated as unknown, not as proof a film cannot be watched. TMDB/JustWatch availability and offers can change.

### Local backend emulators

The Firestore test suite uses a disposable `demo-movie-night` project. Java 21 is required. The Firebase CLI downloads the emulator on first use.

```sh
npm run test:rules
```

To try the full backend locally, use a Firebase demo project configuration in `.env.local`, set `VITE_USE_FIREBASE_EMULATORS=true`, and start:

```sh
npx firebase emulators:start --project demo-movie-night --only auth,firestore,functions
```

Use a gitignored `functions/.env.local` with `ENFORCE_APP_CHECK=false` for local emulators, and a gitignored `functions/.secret.local` with `TMDB_READ_TOKEN=your_local_token` only if testing real TMDB lookups. Do not commit either. The emulator switch is honored only in Vite development mode. For production use App Check and real Firebase settings.

## GitHub Pages deployment

The Vite base path is **`/movie-night-matcher/`**. Assets and hash-based room invite links preserve that path; no server rewrite or SPA fallback is required.

1. In repository **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**. This one-time administrator setting must be enabled before the deployment job can succeed.
2. Push to `main` or run **Test and deploy GitHub Pages** from Actions.
3. The workflow installs locked dependencies, checks TypeScript and backend syntax, runs unit and Firestore emulator rule tests, builds the demo, runs Chromium tests at desktop/mobile sizes plus axe accessibility checks, rebuilds with public Firebase variables, uploads `dist`, and deploys with the official Pages actions.
4. Review the workflow’s `github-pages` environment URL. It should be `https://yis4u.github.io/movie-night-matcher/`.

A failed check blocks deployment. Pull requests run verification without publishing. The workflow has read-only repository contents access; only the deploy job receives `pages:write` and `id-token:write`. It never pushes rewritten history or a build branch.

Each build uploads an artifact named with its workflow run ID and attempt number. The build job passes that exact name to the deployment job, so full reruns do not create ambiguous `github-pages` artifacts and deployment-only reruns can reuse the successful build. Use **Re-run failed jobs** to retry publishing after correcting a Pages setting.

After publishing, the deployment job checks the public URL against the built HTML checksum and verifies that JavaScript, CSS, poster art, and the favicon load under `/movie-night-matcher/`. It retries while GitHub Pages updates its cache. A successful workflow therefore confirms that the built frontend is available at the public URL.

## Validation

```sh
npm run check
npm test
npm run test:rules
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

Browser tests cover two real demo voters in separate tabs; invite, vote, match, changed vote, and host-close flows; keyboard voting and dialog focus; search/filter empty states; missing-provider disclosure and country selection; invalid codes; layouts at 320, 360, 390, 768, and 1440 pixels; shortlist persistence and removal; exact custom room decks across filter changes; mood and surprise discovery; poster CDN failure fallbacks; new-match celebration accessibility; and WCAG A/AA automated checks. Firestore tests verify membership-only reads, vote integrity, host-only closure, and server-data isolation. Live Google/Firebase/TMDB integration requires your configured project and should be smoke-tested after backend deployment.

On a machine with system Chromium already installed, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium` for the browser tests. `E2E_BASE_URL` can target an already-running production preview or deployed demo. Test artifacts are ignored locally and retained for failed CI runs.

## Credits

Built with React, TypeScript, Vite, Firebase, Lucide, DM Sans, and Manrope. Fonts are bundled locally; no external font request is required. The original generated cinematic hero is optimized to a roughly 100 KB WebP; fallback poster illustrations are SVG artwork created for this app. Movie metadata and posters use [TMDB](https://www.themoviedb.org/); streaming availability is powered by [JustWatch](https://www.justwatch.com/) via TMDB.

This product uses the TMDB API but is not endorsed or certified by TMDB.
