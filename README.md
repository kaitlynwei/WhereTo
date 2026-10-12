# WhereTo

WhereTo is a travel-discovery website for choosing a destination, finding a neighborhood, and discovering real places nearby. It uses React/Vite, Firebase Authentication and Firestore, Google Places/Maps, and a small Node API for OpenAI-powered recommendations.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env`.
3. Fill in the Firebase web configuration, the website-restricted Google Maps key, and the private OpenAI key.
4. Run `npm run dev`.
5. Open `http://localhost:5173/`.

The launcher reserves ports 5173 and 8787. If one is already occupied, close the older WhereTo terminal with Control + C before restarting. Do not open `index.html` directly as a `file://` page.

## Commands

- `npm run dev` — start the website and API together
- `npm run dev:web` — start only Vite
- `npm run dev:api` — start only the Node API
- `npm test` — run backend validation, grounding, rate-limit, and HTTP tests
- `npm run test:auth` — run sign-up, sign-out, and sign-in against the local Firebase Auth emulator
- `npm run test:rules` — run the fake-user Firestore rules suite (requires a local Java runtime)
- `npm run test:all` — run all three suites
- `npm run build` — create the production frontend bundle

## Environment variables

Browser variables beginning with `VITE_` are bundled into frontend code. Firebase web configuration is designed for browser use, and the Google Maps key must be protected with website/referrer restrictions plus restrictions to only the Maps JavaScript API and Places API (New).

`OPENAI_API_KEY` is private and is read only by the Node server. Never add `VITE_` to it, place it in frontend code, print it, or commit `.env`.

For deployment, set `WHERETO_API_HOST=0.0.0.0` if the platform requires it, set `WHERETO_ALLOWED_ORIGINS` to the exact production website origin, and set `WHERETO_TRUST_PROXY=true` only when the server is behind a trusted proxy that overwrites `X-Forwarded-For`. Route `/api/*` to the Node server from the same public origin as the frontend.

## Firebase setup

1. Enable Email/Password in Firebase Authentication.
2. Create a Cloud Firestore database.
3. Open Firestore Database → Rules, replace the editor contents with `firestore.rules`, then click **Publish**.
4. Add `localhost` and the production hostname to Authentication → Settings → Authorized domains as needed.

The client stores data under:

```text
users/{uid}
users/{uid}/trips/current
users/{uid}/trips/current/savedPlaces/{placeId}
users/{uid}/preferences/{destinationId}
```

The current Trip document contains `destinations`, `dates`, `stay`, `preferences`, and an empty `itinerary` field reserved for later work. Its saved-place subcollection keeps stable Google Place IDs and is assembled into `trip.savedPlaces` in the app. On first load, existing records from the older `savedPlaces` and `stays` collections are copied into the current Trip.

Destination preference documents store an `interested` or `not-interested` signal plus a small category snapshot. They are used to reorder discovery results for that account; a “not interested” destination stays available but moves lower.

The rules require the signed-in UID to match `{uid}` and validate every writable field. `firebase.json` points Firebase CLI deployments at the same rules file.

## Google Cloud setup

Enable billing for the same Google Cloud/Firebase project, then enable:

- Maps JavaScript API
- Places API (New)

Restrict the browser key to **Websites** and add local and production referrers. Restrict its API access to only those two APIs. Configure billing budgets and quota alerts before publishing publicly.

## API status and safety

- `GET /api/health` reports whether the API is running and whether OpenAI is configured, without returning credentials.
- `GET /api/ai/status` supports the frontend configuration check.
- `POST /api/ai` accepts bounded JSON only, rejects unexpected origins, rate-limits requests, uses structured outputs, and removes any recommended Place ID that was not supplied in the request's Google Places candidates.
- `POST /api/official-price` checks only the public official website returned by Google Places. It follows a small number of same-site ticket links, prefers structured offer data, caches results, and never invents a price when the official site does not publish one.
- Error responses include a request ID for troubleshooting. Logs contain status and request IDs, not prompts or credentials.

The built-in limiter is suitable for local development and a single server instance. A public multi-instance deployment should use the hosting provider's gateway rate limiting or a shared rate-limit store.

## Deployment checklist

No deployment is performed by this repository.

1. Choose a host that can run the Node API and serve the Vite `dist` output, or use two services with a same-origin `/api` proxy.
2. Add production environment variables in the host's secret/configuration settings.
3. Publish `firestore.rules`.
4. Add the production hostname to Firebase Authorized domains and Google key website restrictions.
5. Configure Google and OpenAI spending limits/alerts.
6. Run `npm test` and `npm run build` in CI.
7. Check `/api/health` after release.

See `docs/itinerary-plan.md` for the intentionally deferred itinerary feature.
