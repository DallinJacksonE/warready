# War Ready

A shared training journal and progress tracker for two brothers working toward their fitness goals by October 16, 2027: improving Marine fitness test performance and reaching the 1,000 lb club through the combined one-rep squat, bench press, and deadlift.

## Features

- Two administrator accounts, each with their own profile, goals, and training journal.
- Public journal feed and workout/milestone calendar.
- Optional fitness and strength observations attached to journal entries.
- Personal-best tracking, progress bars, and historical progress timelines.
- Plain-text journal import from `.txt` and `.md` files.

**Privacy:** profiles, journals, and calendar entries are publicly readable. Login protects editing, not viewing. To restrict the entire site to two people, put the public hostname behind a Cloudflare Access policy allowing only your identities.

## Deployment overview

Docker Compose runs two containers:

| Service | Purpose | Network exposure |
| --- | --- | --- |
| `app` | Node/Express API and built React frontend | `127.0.0.1:<APP_PORT>` on the server, forwarded to container port 3000 |
| `mysql` | MySQL 8.4 database | Private Compose network only, on port 3306 |

Both services already use **`restart: unless-stopped`** in `compose.yaml`. They run in the background, restart after a process exit, and come back after a server reboot when Docker starts. A container you explicitly stop stays stopped until you start it again. Health checks report readiness; an unhealthy status alone does not trigger a Docker restart.

Database data lives in a named Docker volume and survives container replacement. You do not need Node.js or MySQL installed on the host.

## First-time setup

Prerequisites: Git, Docker Engine, Docker Compose, and permission to use the Docker daemon. Run the commands below on your home server. If you already have this checkout, skip cloning and enter its directory instead.

```sh
git clone https://github.com/DallinJacksonE/warready.git
cd warready
```

On a systemd-based Linux server, enable Docker at boot and start it now:

```sh
sudo systemctl enable --now docker
docker compose version
```

Create your private configuration once. Do not overwrite an existing `.env`:

```sh
cp -n .env.example .env
chmod 600 .env
nano .env
```

Replace every `CHANGE_ME` value with a unique random password of at least 12 characters. Set the two account usernames and display names before the first startup. Keep `.env` private; it is excluded from Git and Docker builds.

### Choose the host port

Check ports already in use:

```sh
ss -ltn
```

Choose an unused host port in `.env`. For example, for local HTTP access on port 18080:

```dotenv
APP_PORT=18080
APP_ORIGIN=
COOKIE_SECURE=false
```

With an empty `APP_ORIGIN`, Compose uses `http://localhost:<APP_PORT>`. If your `.env` already sets an explicit origin, update or clear it when changing ports. Open that exact origin in your browser: `localhost` and `127.0.0.1` are different origins for login/write checks.

Only the app publishes a host port. MySQL's internal port 3306 will not conflict with a database on your server or in another Docker stack. Leave internal container ports unchanged.

The app binds to loopback only, so this local URL is reachable on the server itself, not directly from other machines on your LAN. Use the tunnel for remote access.

### Build and run in the background

From the directory containing `compose.yaml`:

```sh
docker compose config --quiet
docker compose up --build -d --wait
docker compose ps
```

`-d` runs the services in the background; `--wait` waits for readiness. The `unless-stopped` restart policy is already part of the Compose configuration, so no additional restart flag or separate `docker run` command is needed.

For the local port example above, verify the app and database are ready:

```sh
curl --fail http://127.0.0.1:18080/api/health
```

The health endpoint should return `{"status":"ok"}`. Open `http://localhost:18080` from the server to sign in using the credentials you configured.

## Cloudflare Tunnel

For public HTTPS hosting, change these values in `.env`, keeping your database and account settings:

```dotenv
APP_PORT=18080
APP_ORIGIN=https://training.example.com
COOKIE_SECURE=true
```

Replace `training.example.com` with your real hostname. The origin must be exact, with no trailing slash. Apply the configuration:

```sh
docker compose config --quiet
docker compose up -d --wait
```

Configure the published application route in your Cloudflare Tunnel:

| Where `cloudflared` runs | Tunnel service URL |
| --- | --- |
| Directly on the home server | `http://127.0.0.1:18080` |
| Container with host networking on Linux | `http://127.0.0.1:18080` |
| Container attached to this app's Compose network | `http://app:3000` |

A container's own `localhost` does not refer to your server or the app container. For shared Docker networking, identify the network with `docker network ls` (normally `warready_default`) and attach your connector to it. The tunnel then uses internal port 3000, not `APP_PORT`.

Cloudflare provides public HTTPS while the connector reaches the app over local HTTP. Do not forward router ports or expose MySQL. The tunnel connector is managed separately from this stack; make sure it also starts after server reboots.

Verify the public deployment, replacing the example hostname:

```sh
curl --fail https://training.example.com/api/health
```

If Cloudflare Access protects the site, verify through an authenticated browser instead. Sign in and test creating/editing an entry through the public HTTPS URL. With secure cookies enabled, use that URL for authenticated work rather than local HTTP. Do not cache `/api/*` in Cloudflare.

See the [operations guide](docs/guide.md#cloudflare-tunnel) for proxy/rate-limit considerations and the [Cloudflare documentation](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/) for published application routing.

## Everyday commands

Run these from your checkout directory.

```sh
# Container status and health
docker compose ps

# Follow recent app/database logs; Ctrl+C exits logs without stopping services
docker compose logs --tail=100 -f app mysql

# Restart existing containers without applying configuration changes
docker compose restart

# Start again after an intentional stop
docker compose up -d --wait

# Apply .env / Compose changes, rebuilding if needed
docker compose up --build -d --wait

# Stop services and keep their containers and database volume
docker compose stop

# Remove containers/network while keeping the database volume
docker compose down
```

`docker compose restart` does not apply changed environment variables or host port mappings. Use `docker compose up -d --wait` for configuration changes, or include `--build` when application code changed. If you change `APP_PORT`, also update a tunnel route that targets the host port.

**Never run `docker compose down -v` unless you intend to erase the database.** Avoid launching another checkout with the same default Compose project name (`warready`), because it would manage the same stack.

## Updating the application

Back up the database first. Then, with your local work committed or otherwise safely preserved:

```sh
git pull --ff-only
docker compose config --quiet
docker compose up --build -d --wait
docker compose ps
```

Review any new `.env.example` settings without replacing your private `.env`. Existing database data and accounts remain in the volume. Editing bootstrap account passwords in `.env` does **not** reset passwords for accounts already initialized in the database.

## Backups

From the checkout directory, create a private SQL dump before updates and on a regular schedule:

```sh
umask 077
docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" exec mysqldump --single-transaction --no-tablespaces -u"$MYSQL_USER" "$MYSQL_DATABASE"' > "warready-backup-$(date +%Y%m%d-%H%M%S).sql"
```

Confirm the command succeeds and the dump is nonempty. Store an encrypted copy off the server and test restoration into a separate disposable database. Backups contain journal content, password hashes, and session data; treat them as sensitive.

## Development

The application uses React, TypeScript, and Vite for the frontend; Express for the API; and MySQL for persistence. Node.js 22+ is recommended for native development.

```sh
npm ci
npm run build
npm test
npm run lint
```

For native development setup, architecture, API contracts, and security details, see [docs/guide.md](docs/guide.md).
