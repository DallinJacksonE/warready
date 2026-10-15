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

A local `.env` has already been generated for this working copy, with random passwords and mode 600. It is ignored by git and excluded from Docker builds. Open it locally to retrieve the `dj` and `brother` login passwords; do not paste it into chat or commit it.

For another checkout:

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

Open `http://localhost:8080`. The app port is bound only to loopback, and MySQL has no published host port. Compose starts MySQL 8.4 and a non-root Node container serving both the React bundle and API. A named volume preserves data through container replacement.

Safe routine commands:

```sh
docker compose ps
docker compose logs --tail=100 app
docker compose stop
# Restart without rebuilding:
docker compose up -d --wait
```

Do not delete `mysql_data` or run `docker compose down -v` unless you explicitly intend to erase all training history.

`APP_ORIGIN` must match the browser origin exactly, with no trailing slash. If changing ports, set both `APP_PORT` and `APP_ORIGIN`. Visiting `127.0.0.1` when configured for `localhost` is a different origin: public reads work, but login/writes are intentionally rejected. Use the configured URL.

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
