# 2026 Fantasy Draft Kit & Live Draft Assistant

A complete draft-day toolkit for your 12-team Yahoo league (custom PPR scoring, pick slot #6):

- **Web app** — React + TypeScript + Tailwind, runs standalone, deployable free on Vercel or Netlify.
- **Chrome Extension (Manifest V3)** — the exact same app running in Chrome's native Side Panel or as a popup, with a content script that live-scrapes Yahoo draft rooms (real and mock) and auto-syncs picks.
- **Custom scoring engine** — your league's exact rules (passing/rushing/receiving/return/kicking/DEF, all the milestone bonuses) baked in and locked by default.
- **VORP + tiers**, a **recommendation engine**, an **availability forecaster**, a **mock draft simulator** with AI bots, a **watchlist**, an **RB handcuff matrix**, and a **roster tracker**.
- **Offline dataset**: 300+ players preloaded so it works instantly with zero setup, plus a one-click **"Refresh Data"** that pulls live injury statuses, trending waiver adds, and real news headlines (see Section 4) so day-of-draft changes — injuries, suspensions, legal trouble, depth-chart moves — actually show up before you're on the clock.

Nothing below is required to use the app — it works fully offline out of the box with your exact league scoring. The API setup sections are only for the *optional* live-data features (Section 4) and Yahoo OAuth settings pull (Section 5).

---

## 1. Local Development

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`. Everything — draft state, watchlist, settings — is stored per-browser in `localStorage`, so nothing you do here touches anyone else.

Other useful scripts:

```bash
npm run build            # production build of the web app -> dist/
npm run build:extension  # production build of the Chrome extension -> extension/dist/
npm run build:all        # both of the above
npm run build:data       # regenerate src/data/players.generated.json from scripts/raw-adp.mjs
npm run preview          # locally preview the production build
```

---

## 2. Free Cloud Hosting (Vercel or Netlify) — under 3 minutes

The app is a static single-page app with client-side-only state (each visitor's browser holds their own draft state independently), so **5, 10, or 50 people can use the same hosted URL simultaneously with zero server cost and no rate limits** — there's no shared backend to bottleneck. The only network calls the app makes are to free public third-party APIs (Sleeper) directly from each visitor's own browser.

### Option A: Vercel (recommended, includes the optional Yahoo OAuth proxy)

```bash
npm install -g vercel   # one-time
npx vercel               # from the project root; follow the prompts
npx vercel --prod        # promote to your production URL
```

`vercel.json` is already configured with the SPA rewrite rule and is set up to auto-detect the `/api/yahoo/*` serverless functions if you want Yahoo OAuth (see Section 5) — otherwise they simply go unused.

### Option B: Netlify

**Git integration (no CLI needed):** push this repo to GitHub, then in the Netlify dashboard: *Add new site → Import an existing project → pick the repo*. Netlify reads `netlify.toml` automatically (build command `npm run build`, publish directory `dist`, SPA fallback, and the `netlify/functions/*` Yahoo OAuth proxy).

**Or via CLI:**

```bash
npm install -g netlify-cli   # one-time
netlify deploy --build       # preview deploy
netlify deploy --build --prod
```

Both platforms' free tiers comfortably cover a friend group / league of 5–12 people using this during draft season.

---

## 3. Chrome Extension Installation

1. Build the extension bundle:
   ```bash
   npm run build:extension
   ```
   This populates `extension/dist/` — the `extension/` folder is now a complete, self-contained unpacked extension (`manifest.json` + `background.js` + `content.js` + `dist/`).

2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the `extension/` folder (not `extension/dist` — the folder containing `manifest.json`).
5. Pin the extension (puzzle-piece icon → pin) for quick access.

**Opening the Side Panel:** right-click the extension's toolbar icon → **Open side panel**. (Chrome shows this automatically for any extension that declares `side_panel` in its manifest.) You can also click the icon for the popup version of the same app.

**Using it during a draft:** navigate to your Yahoo fantasy football draft room or mock draft room (`football.fantasysports.yahoo.com/...`). The content script (`content.js`) detects the page, and the side panel's header will flip to **"Sync: Connected 🟢"**. As picks happen in the Yahoo draft room, they're detected via a `MutationObserver` on the pick history / draft board and reflected in the app automatically (target: under 200ms from DOM change to UI update).

### If live sync breaks

Yahoo periodically tweaks its draft room markup, and mock draft rooms sometimes differ slightly from live ones. `extension/content.js` is written defensively (several fallback selectors, plus text-pattern parsing rather than relying purely on class names), but if a redesign breaks it:

1. Open DevTools on the Yahoo draft room page (F12).
2. Find the element that lists completed picks (search the Elements panel for a drafted player's name).
3. Update the `SELECTORS` object at the top of `extension/content.js` with the new container/row selector.
4. No rebuild needed — content scripts reload automatically when you refresh the Yahoo tab (or click the reload icon on `chrome://extensions` if you edited manifest-level things).

You can always fall back to manually clicking **"Draft"** next to a player in the app itself — the assistant (recommendations, VORP, forecaster) works identically whether picks are synced automatically or entered by hand.

---

## 4. Live Rankings, Injuries & News — Keeping "Best Player Available" Actually Current

An offline dataset alone goes stale the moment real news breaks — an injury, a suspension, a legal situation, a surprise depth-chart change. The **"Refresh Data"** button in the header (and the "Save Key & Pull Expert Rankings" button in Settings) pulls from three free sources, layered so the app degrades gracefully if any one of them is unavailable:

| Source | What it adds | Setup |
|---|---|---|
| **Sleeper API** | Injury status + current team for every player | None — free, no key, always on |
| **Sleeper Trending** (`trending/add`, `trending/drop`) | 🔥 badge on players the whole league is suddenly adding — often the *first* signal something happened, ahead of any rankings site | None — free, no key, always on |
| **ESPN news feed** | Real headlines matched to players — this is what actually catches "legal trouble" or "position change" stories, since those show up as narrative text, not a structured status field | None — free, no key, always on. **Caveat:** this is ESPN's internal endpoint (the same one espn.com's own site uses), not an officially published third-party API — it can change or stop working without notice. The app just shows fewer headlines if that happens; nothing else breaks. |
| **FantasyPros API** | Real expert **consensus rankings (ECR)** + their injury/news wire — shown as an "ECR" column next to your custom rank, and sortable | Requires your own free API key (below) |

**Why not just replace your rankings with these?** Sleeper and ESPN don't publish rankings, only status/news — and FantasyPros' free tier is licensed for personal use (see below), so it's shown as a second opinion (the ECR column) rather than silently overriding the custom-scoring VORP ranking that's this app's whole point. If your custom rank and FantasyPros' ECR disagree by 10+ spots, that's flagged in the table so you can decide for yourself.

### Setting up the FantasyPros API key (optional, free)

1. Go to **https://secure.fantasypros.com/api-keys/request/** and request a free API key (you'll need a FantasyPros account — free to create).
2. **Read the license terms shown on that page carefully.** FantasyPros' free tier is scoped to **personal, non-commercial, non-production use**. Practically:
   - Using it yourself, locally, or in a deployment only you use: fine.
   - Using it in the hosted version of this app that your 5 league-mates also open: technically stretches "personal use" — FantasyPros' own answer for that is their **Premium** tier, included with an active paid FantasyPros Hall of Fame subscription, or a separate commercial agreement for anything redistributing their data at scale. This app doesn't make that call for you — it's between you and FantasyPros' terms.
3. Paste the key into **Settings → Live Rankings, Injuries & News** in the app and click **Save Key & Pull Expert Rankings**. The key is stored only in your own browser (`localStorage`) and sent with each request to this project's own `/api/fantasypros` serverless proxy, which forwards it to FantasyPros — it's never committed to the repo or shared with other users of a hosted deployment unless they each paste in their own key.

FantasyPros' exact JSON field names aren't fully pinned down in their public docs and can shift between endpoint versions — `src/lib/fantasyProsApi.ts` parses defensively (tries several plausible key names per field) rather than assuming one exact shape. If a refresh ever returns 0 expert ranks despite a valid key, that's the first place to look — log the raw response from `/api/fantasypros` once to see the actual field names and adjust the `firstOf(...)` candidate lists.

---

## 5. Yahoo OAuth Setup (Optional)

**You do not need this to use the app.** Skip it entirely and the app uses your exact hardcoded league scoring (already preloaded — see Section 7). This section is only for the optional **"Sync League Settings from Yahoo"** button in Settings, which pulls your league's settings directly from Yahoo's API for confirmation/reference.

### Step 1 — Create a Yahoo Developer App

1. Go to **https://developer.yahoo.com/apps/** and sign in with your Yahoo account (the same one on your fantasy league).
2. Click **Create an App**.
3. Fill in:
   - **Application Name**: anything, e.g. `My Fantasy Draft Kit`
   - **Application Type**: `Web Application`
   - **Description**: optional
   - **Home Page URL**: your deployed URL (e.g. `https://your-app.vercel.app`) — `http://localhost:5173` works fine for local testing too
   - **Redirect URI(s)**: this **must exactly match** what the app sends. Add both, one per line, so it works locally and once deployed:
     ```
     http://localhost:5173/api/yahoo/callback
     https://your-app.vercel.app/api/yahoo/callback
     ```
     (Swap in your actual Vercel/Netlify URL once you know it — you can always come back and add it later.)
   - **API Permissions**: check **Fantasy Sports** → **Read**.
4. Click **Create App**.
5. You'll land on the app's details page showing your **Client ID (Consumer Key)** and **Client Secret (Consumer Secret)**. Keep this tab open — you'll need both.

### Step 2 — Configure your deployment's environment variables

The Consumer Secret must **never** be shipped in client-side code (the web bundle or the extension) — it's a server secret. This project already includes a small serverless proxy (`/api/yahoo/*` for Vercel, `netlify/functions/yahoo-*` for Netlify) that holds it safely server-side.

**Vercel:**
```bash
vercel env add YAHOO_CONSUMER_KEY
vercel env add YAHOO_CONSUMER_SECRET
vercel env add YAHOO_REDIRECT_URI    # e.g. https://your-app.vercel.app/api/yahoo/callback
vercel --prod                        # redeploy so the functions pick up the new env vars
```
(Or set them in the dashboard: **Project → Settings → Environment Variables**.)

**Netlify:**
```bash
netlify env:set YAHOO_CONSUMER_KEY "your-key"
netlify env:set YAHOO_CONSUMER_SECRET "your-secret"
netlify env:set YAHOO_REDIRECT_URI "https://your-app.netlify.app/api/yahoo/callback"
netlify deploy --build --prod
```
(Or **Site configuration → Environment variables** in the dashboard.)

### Step 3 — Connect in the app

Open **Settings** in the app → paste your **Consumer Key** into the "Yahoo Consumer Key" field → click **Connect to Yahoo**. You'll get Yahoo's consent screen, then land back in the app with your league settings retrieved.

- **Inside the Chrome extension**, this uses `chrome.identity.launchWebAuthFlow` — no popups or redirect pages needed, and no Consumer Secret required client-side at all (the extension flow can use the redirect URL Chrome generates for it: run `chrome.identity.getRedirectURL()` in the service worker console to see it, and add that as an additional Redirect URI on your Yahoo app if you want the extension's own OAuth flow to work independently of the web app's).
- **In the standalone web app**, it opens a popup to Yahoo's consent screen, which redirects to `/api/yahoo/callback` and hands the code back to the app via `postMessage`.

### What you get back

Yahoo's Fantasy Sports API returns settings in a deeply nested, league-specific JSON shape. `api/yahoo/settings.js` (or its Netlify twin) returns the **raw** settings payload rather than guessing a mapping, since every league's `stat_id` scoring modifiers are structured slightly differently. If you want to wire this up to actually override the app's scoring engine automatically, map the `stat_modifiers` array's `stat_id`/`value` pairs onto `ScoringSettings` in `src/lib/leagueSettings.ts` — but since your league's scoring is already hardcoded exactly (Section 7), most people can just use the raw payload to double-check nothing has changed and stop there.

---

## 6. Other APIs Used — Full Reference

| API | Used for | Auth required? |
|---|---|---|
| **Sleeper API** (`api.sleeper.app/v1/players/nfl`) | Live injury statuses & current team | **No** — fully public, no key, no signup. Cached 6 hours per browser. |
| **Sleeper Trending** (`.../trending/add`, `.../trending/drop`) | 🔥 real-time waiver-add surge signal | **No** — same as above. |
| **ESPN NFL news feed** (`site.api.espn.com/.../news`) | Headline-matched player news | **No** — free, but unofficial/undocumented (see Section 4). |
| **ESPN team roster API** (`site.api.espn.com/.../teams/{id}/roster`) | Player headshots in the player detail drawer | **No** — free, same unofficial-endpoint caveat as the news feed. Falls back to a generated initials avatar if a player isn't found or the request fails. |
| **FantasyPros API** (`api.fantasypros.com/v2`) | Expert consensus rankings (ECR) + injury/news wire | Yes — free personal-use key, see Section 4. |
| **Yahoo Fantasy Sports API** | Optional league-settings confirmation | Yes — OAuth2, see Section 5. Entirely optional. |

We evaluated a few other "free fantasy football API" options that turned up in research and ruled them out: **FantasyNerds** has no free tier (paid plans start at $499/yr); **FantasyData/SportsDataIO** are commercial platforms (free trial only, not a standing free tier). FantasyPros is the one genuine free source of real expert-consensus rankings — see Section 4 for its personal-use licensing caveat before relying on it in a shared deployment.

There's still no free, public, unauthenticated *ADP* JSON feed independent of FantasyPros' keyed API — so the offline dataset's ADP order and player identities in `src/data/players.generated.json` come from a real consensus snapshot instead; see Section 8 for how projections are generated and how to refresh the raw list yourself later in the season.

---

## 7. League Configuration (Locked Defaults)

Preloaded for a 12-team Yahoo league, pick slot #6, 2026 season:

- **Roster**: 1 QB, 2 RB, 2 WR, 1 TE, 2 FLEX (W/R/T), 1 K, 1 DEF · 8 Bench · 5 IR (18 rounds)
- **Passing**: 6 pt/TD · 0.04 pt/yd (25 yd = 1 pt) · +0.25 pt/completion · −2 pt/INT · −1 pt/sack taken · +5 pt bonuses at 300/400/500 yds
- **Rushing**: 6 pt/TD · 0.1 pt/yd (10 yd = 1 pt) · +2 pt/2-pt conversion · −2 pt/fumble lost · +5 pt bonuses at 100/200 yds
- **Receiving**: Full PPR (1 pt/reception) · 6 pt/TD · 0.1 pt/yd · +5 pt bonuses at 100/200 yds
- **Returns**: 0.0285 pt/yd (35 yd = 1 pt) · 6 pt/return TD
- **Kicking**: 0–39 yd FG = 3 pt · 40–49 yd = 4 pt · 50+ yd = 5 pt · XP = 1 pt
- **D/ST**: 1 pt/sack · 2 pt/INT, fumble recovery, safety, or blocked kick · 6 pt/TD · points-allowed tiers from +25 (shutout) down to −10 (35+ allowed)

Edit `src/lib/leagueSettings.ts` directly if any of this ever changes — every projection, VORP score, and tier recalculates automatically from that one file.

---

## 8. Offline Dataset & Projections — How It Works

`scripts/raw-adp.mjs` holds a real consensus ADP snapshot (300+ skill-position players + all 32 team defenses, plus 2026 bye weeks) as of late August 2026. `scripts/build-players.mjs` turns that into full-season *statistical* projections (yards, TDs, receptions, etc.) using a position-specific usage-curve model driven by each player's rank within their position — not hand-typed guesses for 300 players, and not real per-player final projections from a paid provider either. This keeps the dataset internally consistent (a bell-curve of realistic workloads at each position) and lets the actual scoring engine (`src/lib/scoring.ts`) — your league's real rules — derive every player's fantasy points, VORP, and tier the same way it would for any future live data source.

**To refresh later in the season:**
1. Update `scripts/raw-adp.mjs` with a newer ADP order (copy/paste from any public rankings page) and current bye weeks if they change.
2. Run `npm run build:data` to regenerate `src/data/players.generated.json`.
3. Rebuild (`npm run build` / `npm run build:extension`).

If you'd rather plug in real per-player season projections from a provider you already subscribe to (e.g. an exported CSV), replace the `stats` object per player in the generated JSON, or extend `build-players.mjs` to read your source file instead of the synthetic curve — the rest of the app (scoring, VORP, tiers, recommendations) needs no changes since it all derives from `StatLine` objects.

---

## 9. Project Structure

```
src/
  lib/            scoring engine, VORP/tiers, recommendation engine, bot AI,
                   availability forecaster (normal-distribution ADP model),
                   Yahoo OAuth helper, FantasyPros/ESPN/Sleeper clients,
                   the "Refresh Data" orchestrator (dataRefresh.ts), storage adapter
  store/           Zustand store — draft state, picks, rosters, watchlist,
                    mock-draft simulator, persisted to localStorage /
                    chrome.storage.local automatically depending on context
  data/            offline player dataset + the loader that scores it
  components/      all UI (board, recommendations, forecaster, sim controls,
                    roster tracker, handcuff matrix, watchlist, news feed, settings)
  hooks/           mock-draft auto-run loop, Chrome extension message sync
scripts/           dataset generation (raw ADP -> full projections)
extension/         Chrome MV3 extension (manifest, background, content script)
                    + extension/dist (built React app, generated)
api/               Vercel serverless functions — Yahoo OAuth proxy (api/yahoo/*),
                    FantasyPros proxy (api/fantasypros), ESPN news proxy (api/espn/news)
netlify/functions/ Netlify Functions equivalents of everything in api/
```

---

## 10. Troubleshooting

- **"Refresh Data" says failed** — each of the four sources (Sleeper, Sleeper Trending, ESPN, FantasyPros) fails independently and the app keeps using cached/offline data either way, so nothing breaks. If it fails every time, check that outbound network requests aren't blocked (corporate network, ad-blocker, browser extension) — these calls go straight from your browser to the third-party API.
- **ECR column always shows "—"** — you haven't saved a FantasyPros API key in Settings yet (it's optional), or the key/rate limit was rejected — check the error message under the "Save Key & Pull Expert Rankings" button.
- **No news headlines showing up** — ESPN's feed is unofficial and can go quiet or change shape without notice (see Section 4); Sleeper Trending and injury status will keep working independently either way.
- **Yahoo OAuth button errors immediately** — you likely haven't set the environment variables yet (Section 5, Step 2) on your actual deployment, or the Redirect URI in your Yahoo app doesn't exactly match your deployed URL's `/api/yahoo/callback`.
- **Side panel looks clipped/empty** — make sure you loaded the `extension/` folder itself (containing `manifest.json`), not `extension/dist`, and that you ran `npm run build:extension` first so `extension/dist/index.html` exists.
- **Draft state looks wrong after changing your pick slot** — changing pick slot intentionally resets the current draft board (rosters/picks), since the entire snake order shifts. Your league scoring settings are unaffected.
