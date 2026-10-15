# War Ready — operations and development

## What this app does

Two private administrator accounts maintain their own public training journals, date-only workout/milestone calendar, fitness goals, and progress history. Visitors do not need an account to read either athlete's profile, journals, or calendar. There is no public registration and no private journal/draft mode: **every saved journal and calendar entry is public**.

The goal date is October 16, 2027. The interface uses accessible semantic color variables in `frontend/src/theme.css` (see the final file tree for actual theme entrypoint), angular industrial panels, and shared button styles. Green is reserved for fitness progress and blue for strength progress.

## Decisions that need your eventual confirmation

1. “1,000 pound club” is interpreted as the sum of your best recorded **one-rep** squat, bench press, and deadlift, measured in lb. The original brief's “three reps” was ambiguous; this does not mean a three-rep max or a same-session verified meet total.
2. Marine fitness progress is an **unofficial personal training indicator**, not an official PFT score or qualification. Default targets are 23 pull-ups, 225-second plank, and 1,080-second three-mile run. Each athlete can edit these targets. Official scoring depends on current rules and demographic factors not collected here.
3. Fitness progress averages three capped fractions: pull-ups / target, plank / target, and target run time / actual run time. Missing observations contribute zero. Faster runs are better; other personal bests use the maximum. Reaching one target cannot compensate for missing another.
4. Historical lookback uses cumulative bests through each journal date. Updating/deleting an observation recalculates history. Historical percentages use the athlete's **current** targets, not a versioned target from that date.
5. Blank optional metrics mean “not measured,” not zero. Strength observations allow fractional pounds. Calendar records are all-day dates with no timezone conversion.
6. Imported `.txt` / `.md` files are plain text, not rendered HTML; Markdown is not interpreted. No files are persisted separately from journal text.

## Quick start with Docker

Prerequisites: Docker Engine with Compose, and permission to access its daemon. The app and database do not need any global Node/MySQL installation.

Create a private `.env` if one does not already exist (do not overwrite an existing configuration). It is ignored by git and excluded from Docker builds:

```sh
cp .env.example .env
chmod 600 .env
# Edit .env: replace every CHANGE_ME value with a unique password (12+ characters).
```

Set the two usernames and display names before the first startup if desired. Then:

```sh
docker compose config --quiet
docker compose up --build -d --wait
```

Open `http://localhost:<APP_PORT>` (8080 by default). The app port is bound only to loopback, and MySQL has no published host port. Compose starts MySQL 8.4 and a non-root Node container serving both the React bundle and API. A named volume preserves data through container replacement.

Safe routine commands:

```sh
docker compose ps
docker compose logs --tail=100 app
docker compose stop
# Restart without rebuilding:
docker compose up -d --wait
```

Do not delete `mysql_data` or run `docker compose down -v` unless you explicitly intend to erase all training history.

`APP_ORIGIN` must match the browser origin exactly, with no trailing slash. In Compose, leaving it empty defaults to `http://localhost:<APP_PORT>`. If your existing `.env` explicitly sets an origin, update it when changing ports or clear it to use this default. Visiting `127.0.0.1` when configured for `localhost` is a different origin: public reads work, but login/writes are intentionally rejected. Use the configured URL.

### Host port configuration

Only `APP_PORT` needs an unused host port. For example, set `APP_PORT=18080` in `.env` to publish `127.0.0.1:18080` to the app container's port 3000. The frontend and API share this one port. No separate frontend/backend host ports are needed.

MySQL stays private on `mysql:3306` inside the Compose network. It does not bind the server's port 3306 and cannot conflict with a host MySQL or another stack's database. Do not add a database port mapping for the tunnel. Internal container ports can stay fixed because each container has its own network namespace. `PORT` and `MYSQL_PORT` in a host `.env` do not override Compose's intentionally fixed internal ports.

Before choosing a port, check the server's listeners with `ss -ltn`. Apply changes with `docker compose up -d --build --wait`; `docker compose restart` alone does not apply changed environment or port mappings. Avoid running multiple copies of this Compose project with its default project name, since they would manage the same stack.

### Cloudflare Tunnel

For a tunnel connector (`cloudflared`) running directly on the home server, use this `.env` example, keeping your existing database/account credentials:

```dotenv
APP_PORT=18080
APP_ORIGIN=https://training.example.com
COOKIE_SECURE=true
```

Replace the hostname with your actual domain. In your tunnel's published application route, select HTTP and set the service URL to `http://127.0.0.1:18080`. Cloudflare provides public HTTPS; the connector reaches the local HTTP origin over loopback. Do not forward router ports or publish MySQL. Changing `APP_PORT` also requires updating this tunnel service URL; it does not change the public HTTPS URL.

If `cloudflared` runs in a container, its `127.0.0.1` refers to that container, not the app or server:

- On a Linux home server, a connector using host networking can use the loopback service URL above.
- Alternatively, attach the connector to this stack's app network and route to `http://app:3000`. Use `docker network ls` to identify the actual network (normally `warready_default`). In this setup, `APP_PORT` is not used by the tunnel; do not route to `app:18080` or attach the connector to unrelated networks unnecessarily.

The connector is not added to this Compose stack, so you can reuse an existing tunnel without storing tunnel credentials in this repository. See [Cloudflare's published application documentation](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/).

After deploying, check `https://training.example.com/api/health`, then sign in from the public HTTPS URL and create/edit an entry. Use that public origin for all authenticated work; local HTTP login is not the intended mode when secure cookies are enabled. Do not configure a Cloudflare cache rule that caches `/api/*`; these responses already send `Cache-Control: no-store`.

The current app does not trust forwarded client-IP headers. Login throttling behind a tunnel may therefore be shared by both users through the connector's IP (10 attempts per 15 minutes), rather than per visitor. Do not blindly enable `trust proxy=true`: configure a trusted proxy boundary before relying on forwarded IPs for per-user rate limiting.

Journals, profiles, and calendar entries are public by design. If only you and your brother should be able to view them, protect the hostname with a Cloudflare Access policy allowing your two identities before publishing it; app login currently protects editing, not reading. Keep private backups before exposing real data.

## Credentials and security

- Exactly two accounts are initialized on a fresh database. Passwords are salted scrypt hashes; plaintext credentials are never stored in application tables or returned by the API.
- Bootstrap is idempotent and **does not overwrite existing account passwords or names on restart**. Merely editing `ADMIN*_PASSWORD` in `.env` is not a password-reset mechanism.
- Sessions are opaque HttpOnly SameSite=Lax cookies, expire server-side, survive app restarts, and are revoked at logout. Only session-token hashes are stored in the database.
- Authenticated writes require the session's CSRF header. Origin checks also protect login and writes. Owner constraints are enforced server-side, not just hidden in the UI.
- Login is rate-limited. Validation rejects unknown fields, impossible dates, negative weights, invalid durations, and oversized requests.
- Journal content is rendered as text, never injected as HTML.
- This is a local deployment, not a hardened public hosting installation. Before exposing it, put it behind HTTPS, set `COOKIE_SECURE=true`, set the exact external `APP_ORIGIN`, and review reverse-proxy trust/rate limiting, backups, traffic limits, and monitoring. Do not enable permissive CORS or expose the MySQL port.
- There is intentionally no self-service registration, email delivery, or password recovery. Account recovery requires a controlled operator action; do not erase the database to reset a password.

## Backup

A SQL backup contains your journal text, account hashes, and active session data; keep it private. The following reads the database without deleting anything:

```sh
umask 077
docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" exec mysqldump --single-transaction --no-tablespaces -u"$MYSQL_USER" "$MYSQL_DATABASE"' > warready-backup.sql
```

Verify the backup is nonempty and store an encrypted/off-device copy. Test restoration into a **separate** disposable database before relying on it. Keep the original database volume until a restore has been checked.

## Developer workflow

```sh
npm ci
npm test
npm run build
```

The root package holds dependencies, TypeScript configuration, and build scripts. `npm run build` performs strict typechecking, emits the backend/shared modules into `dist`, and builds the Vite frontend into `web-dist`.

For Vite hot reload with a reachable local MySQL-compatible database, supply the database and bootstrap variables from `.env`, start the backend on port 3000, and run Vite on its printed local port. Configure `APP_ORIGIN` to that Vite origin. API calls remain relative to `/api` through Vite's proxy. Node 22+ is recommended; the Docker image uses Node 22.

### Architecture

- `shared/contracts.ts`: shared API DTOs, targets, metric definitions.
- `shared/progress.ts`: pure personal-best, progress, duration, and historical-series calculations.
- `backend/`: injectable Express app, validation/auth services, repository boundary, memory test adapter, MySQL production adapter, and startup.
- `frontend/src/service/`: credentialed HTTP transport and CSRF handling.
- `frontend/src/presenter/`: testable interaction orchestration, separate from React.
- `frontend/src/components/` and `views/`: thin state/rendering components and page composition.
- `tests/`: domain, presenter, API/security tests; live browser checks are described in verification documentation.
- `.hermes/implementation.md`: living checklist and decisions.

## API contract

All responses are JSON except successful deletes/logout (204). Failures use `{ "error": "..." }`. Unknown `/api` paths return JSON 404, not the SPA HTML. Dates are `YYYY-MM-DD`; timestamps are UTC ISO strings. Inputs and outputs are defined in `shared/contracts.ts`.

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/health` | Database readiness; 503 if unavailable |
| GET | `/api/bootstrap` | Public users, journals, events; no account hashes |
| GET | `/api/session` | Current public user and CSRF token, or null user |
| POST | `/api/login` | JSON `{username,password}`, sets session cookie |
| POST | `/api/logout` | Revokes cookie session; authentication + CSRF |
| PUT | `/api/profile` | Updates own display name, bio, targets |
| POST | `/api/journals` | Creates own public journal (201) |
| PUT | `/api/journals/:id` | Full replacement of editable fields, owner only |
| DELETE | `/api/journals/:id` | Deletes own journal |
| POST | `/api/events` | Creates own public calendar event (201) |
| PUT | `/api/events/:id` | Replaces own event fields |
| DELETE | `/api/events/:id` | Deletes own event |

For writes, send `Content-Type: application/json` with JSON bodies and `x-csrf-token` from the session response. Logout/delete do not require a JSON body. Authentication failure is 401, invalid CSRF/origin is 403, unavailable/cross-owner entries are 404, invalid payloads are 400, and throttled login is 429.

## Intentional limitations

This is a two-person tracker, so public data is loaded together rather than paginated. Re-evaluate payload size before accumulating many years of large journals. No photo uploads, rich-text editor, recurring workouts, timed reminders, PFT certification, social comments, or medical/training advice are included. No invented workout history is seeded.
