# MagxTV — Sports Streaming Platform

A full-stack sports media platform: **React + TypeScript + Vite** front end, **Express + PostgreSQL** API,
JWT/bcrypt authentication with `user` / `admin` roles, a configurable **sports-data provider adapter**,
and an **HLS.js video player that only plays sources on an explicit allow-list**.

---

## 1. Quick start

```bash
npm install

# Option A — full stack (PostgreSQL + API + built front end)
cp .env.example .env          # then edit .env
npm run db:migrate            # schema + seed users (idempotent)
npm run build                 # typecheck + production build into dist/
npm start                     # API + built app on http://localhost:8787

# Option B — front-end dev with hot reload
npm run dev                   # Vite on http://localhost:5173
npm run api                   # Express API on http://localhost:8787 (separate terminal)
BASE_URL note: set VITE_API_BASE_URL=http://localhost:8787 in .env for this mode.
```

With **no `DATABASE_URL`** the API transparently uses an in-memory store, and with **no
`VITE_API_BASE_URL`** the front end serves its bundled demo catalogue from `localStorage`.
Everything stays usable — every payload is flagged `demo: true` and the UI shows a **DEMO DATA** badge.

### Seed credentials

| Role  | Email                   | Password        | Plan     |
|-------|-------------------------|-----------------|----------|
| Admin | `admin@magxtv.example`  | `MagxAdmin#2026`| premium  |
| User  | `demo@magxtv.example`   | `MagxDemo#2026` | standard |

Both are created by `npm run db:migrate` (PostgreSQL) or `seedMemory()` / `ensureSeed()` (demo mode),
and are offered as one-click logins on the **Sign in** page. **Change them before any public deployment.**

---

## 2. Environment variables (`.env`)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8787` | API port |
| `DATABASE_URL` | *(empty)* | `postgresql://user:pass@host:5432/magxtv`. Empty ⇒ in-memory store |
| `JWT_SECRET` | dev fallback | **Set a long random value in production** |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime |
| `SPORTS_PROVIDER` | `mock` | `mock` \| `xtream` |
| `SPORTS_API_BASE_URL` | *(empty)* | Base URL of **your own licensed** panel/API |
| `SPORTS_API_USER` / `SPORTS_API_PASS` | *(empty)* | Provider credentials — **server-side only, never shipped to the browser** |
| `STREAM_ALLOWLIST` | `test-streams.mux.dev,commondatastorage.googleapis.com` | Comma-separated hosts allowed to play. **Anything else is refused.** |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:4173` | Allowed browser origins |
| `VITE_API_BASE_URL` | *(empty)* | Front-end API base; empty ⇒ bundled demo catalogue |

---

## 3. Sports data provider adapter

`server/src/providers/index.ts` selects the integration at runtime:

* **`mock`** — deterministic generator (`providers/catalog.ts`): 18 competitions across football, cricket,
  basketball, tennis and motorsport with fixtures, live scores, tables, highlights and news. Every
  response carries `demo: true`, surfaced in the UI as the **DEMO DATA** badge.
* **`xtream`** — Xtream-Codes-compatible adapter (`providers/xtream.ts`). Categories and live channels are
  mapped onto the platform taxonomy by group-name heuristics; credentials stay in server env vars, and
  play URLs are resolved per request by `GET /api/player/source/:matchId` so they never reach the client.

Add your own integration by exporting a `ProviderResult` and registering it in the same switch.

### Streaming policy

Only **openly licensed** sources ship with this project: Mux's public HLS test stream, Blender Foundation's
*Big Buck Bunny* / *Tears of Steel* (CC-BY 3.0) and a public-domain MP4 sample. The player and the API both
hard-refuse any host outside `STREAM_ALLOWLIST`, and the API returns `403 Playback refused: …` otherwise.
Point `SPORTS_API_BASE_URL` and `STREAM_ALLOWLIST` at **your own licensed origin** to go live.

---

## 4. Pages (all real, no placeholders)

| Route | Page |
|---|---|
| `/` | Home — cinematic hero, live now, featured leagues, upcoming fixtures, news sidebar |
| `/live` | Live Sports — sport/filter/sort controls, live scoreboard, match grid |
| `/football` `/cricket` `/basketball` `/tennis` `/motorsports` | Sport hubs with matches / table / fixtures tabs |
| `/highlights` | Highlights library with sport filter and search |
| `/schedule` | Schedule — KPI strip, day/list views, favourites-only toggle |
| `/search?q=` | Search across matches, highlights and competitions |
| `/watch/:id` | Watch Match — HLS player, stats, line-ups, commentary, head-to-head, also-live |
| `/favorites` | Saved matches |
| `/profile` | Account, KPIs, notifications, playback preferences |
| `/admin` | Admin dashboard (role-gated): overview, users & roles, catalogue, stream policy |
| `/login` | Sign in / register with validation and demo quick-logins |
| `/credits` | Image credits, stream licences, integration notes |

## 5. API surface

```
GET    /api/health                        service + database + provider status
GET    /api/catalog                       fixtures, leagues, tables, highlights, news (+ demo flag)
GET    /api/provider/status               which integration is live
GET    /api/player/source/:matchId        allow-list-checked playback sources
POST   /api/auth/register                 name + email + password (bcrypt, min 8 chars)
POST   /api/auth/login                    → { user, token }
GET    /api/auth/me                       current user (Bearer token)
GET    /api/favorites                     list
POST   /api/favorites/:matchId            add
DELETE /api/favorites/:matchId            remove
GET    /api/notifications                 list
POST   /api/notifications/read            mark one / all read
GET    /api/admin/users                   role: admin
PATCH  /api/admin/users/:id               role: admin — change role / plan
GET    /api/admin/overview                role: admin — KPIs + stream policy
```

## 6. Screenshots

`npm run shot` (server running on 8787) captures every route at desktop and mobile widths into `shots/`
using Playwright — this is how the delivered screenshots were produced.

## 7. Licensing

All photography is public-domain / CC (PickPik, Freerange Stock, Flickr, Stockvault, Public Domain
Pictures, PICRYL) and credited on `/credits` and in the footer. **No league or club logos are used** —
team crests are generated from team initials and colours. Demo fixtures use fictional team names.

---

## 8. Live TV — connecting your own provider

The platform ships **no** channels, credentials or scraped sources. The demo catalogue is
invented data. To stream real channels you connect a provider **you are licensed to use**:

1. Run the API (`npm start`) and open **`/connect`** (nav → *Live TV*).
2. Enter the provider host, username and password. They are `POST`ed once to **your own API
   server**, verified against the panel, and held only in that server process's **in-memory
   token map for 6 hours**; the browser keeps the session in `localStorage` so a refresh does
   not log you out. Nothing is written into the source tree, `.env.example` or the built bundle.
3. The channel browser lists `get_live_categories` and `get_live_streams`, with search and
   category filters (first 240 rendered).
4. Playback goes through the relay, never the browser: `/api/live/hls/:id.m3u8` for HLS
   (`hls.js`), falling back to `/api/live/ts/:id.ts` for raw MPEG-TS (`mpegts.js`). Playlist
   child URIs are rewritten back through `/api/live/seg`.

### Why a relay instead of direct playback

* **Mixed content** — the panel is usually plain `http://`; a page served over https would block it.
  The relay is same-origin, so this cannot happen.
* **CORS** — the panel sends no CORS headers, so a direct browser fetch fails. The relay is server-side.
* **Credentials** — the browser never learns the origin URL, so the password never appears in
  dev-tools, a referrer header or a copied channel link.

**Security guardrails** — the relay refuses anything else: private/loopback addresses are never
relayed (SSRF guard), only media paths are accepted, and a segment whose host differs from the
connected provider returns `403`. Credentials entered at runtime are **yours**; the app holds no
third-party secrets.

### Troubleshooting

| Symptom | Meaning |
|---|---|
| `Could not reach the provider` | Wrong host/port, or the panel is firewalled off from your server |
| `subscription as "…"` at connect | The panel reports the account as expired or disabled |
| `switching to raw MPEG-TS` | The channel has no HLS playlist — mpegts.js takes over automatically |
| `Session expired` | The 6-hour server session lapsed — reconnect |
| Channel stalls | Often the provider's simultaneous-connection cap, not the app |

---

## 9. Admin → Broadcast (Xtream provider control)

Sign in as an administrator and open **Admin → Broadcast**. This is where the operator
obtains, fetches and loads the live provider that the whole site broadcasts:

1. **Host / Username / Password** — an Xtream-Codes compatible `player_api.php` endpoint.
   `http://` is fine, because playback is relayed by this server.
2. **Test connection** — verifies the credentials against the panel *without* saving, and
   reports subscription status, days remaining, expiry and the connection cap.
3. **Obtain & save broadcast** — re-verifies, then stores the provider **server-side**
   (`provider_config` in PostgreSQL, or the API process's memory when no database is set).
   The password is returned to the panel only as a mask (`••••••`) plus its length; leaving
   the field blank keeps the stored secret, so an operator never has to retype it.
4. **Fetch & load channels** — pulls `get_live_categories` + `get_live_streams`, shows the
   real group names with per-category counts, and loads up to 2,000 channels (first 300 shown,
   searchable). **Probe** on any channel opens its playlist through the relay and reports
   HTTP status, whether it is HLS or raw MPEG-TS, variant and segment counts.
5. **Disconnect provider** — deletes the stored configuration.

Once configured, the header strip on every page reads **LIVE PROVIDER CONNECTED**, and
signed-in viewers get the roster at **`/channels`** (nav → *Channels*). Viewers receive a
30-minute playback grant that contains no credentials: the relay looks the provider up from
the server-side configuration on each request, so rotating the provider invalidates old grants.

```
GET    /api/admin/provider            current provider (password masked)      role: admin
POST   /api/admin/provider/test       verify without saving                    role: admin
POST   /api/admin/provider/connect    obtain → verify → save                  role: admin
DELETE /api/admin/provider            remove the stored provider               role: admin
GET    /api/admin/provider/channels   fetch & load channels + categories       role: admin
GET    /api/admin/provider/probe/:id  what the panel actually serves for a channel
GET    /api/broadcast/catalog         viewer roster (signed in)
POST   /api/broadcast/token           30-minute playback grant (signed in)
```

> **Security**: the provider password is stored in plain text so the panel can reconnect
> unattended. Encrypt it at rest or move it to a secrets manager before production, and keep
> database access restricted. Credentials entered here are **yours**; the repository ships none.
