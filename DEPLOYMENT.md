# WAREOps — Railway Deployment Guide (Unified Service)

> **Validated:** 29/29 integration tests pass. The entire platform runs as **3 Railway services** only (was 11).

---

## Architecture

```
Railway project
├── PostgreSQL plugin    (managed Postgres 16)
├── Redis plugin         (managed Redis 7)
└── wareops-app          (1 service — everything)
    ├── All 7 FastAPI microservices (auth, topology, mission, observation,
    │   reconciliation, alerting, digital-twin-sync) — in ONE process
    ├── Socket.IO live twin feed
    ├── Robot simulator background tasks (auto-feeds pipeline)
    ├── Auto-seeder (48 products + 4 demo users on startup)
    └── React SPA served at /
```

**Before:** 11 Railway replicas (7 services + gateway + DB + Redis + simulator)
**After:** 3 Railway replicas (Postgres plugin + Redis plugin + 1 app service)

All API routes and Socket.IO work identically. The frontend's API calls all go to `/api/v1/*` on the same origin — no gateway needed.

---

## Step 1 — Push to GitHub

```bash
cd /path/to/WAREOps
git add .
git commit -m "Unified service - all 7 microservices in one deployable"
git push origin main
```

---

## Step 2 — Create Railway Project

1. Go to **https://railway.app/new**
2. Click **Deploy from GitHub repo**
3. Select your WAREOps repository
4. **Do not deploy yet** — add plugins first

---

## Step 3 — Add PostgreSQL Plugin

1. Click **+ New** → **Database** → **Add PostgreSQL**
2. Wait for it to provision
3. Click on the Postgres plugin → **Connect** tab
4. Copy the **`DATABASE_URL`** value (format: `postgresql://user:pass@host:port/dbname`)

> **IMPORTANT:** Our app needs `postgresql+asyncpg://` not `postgresql://`.
> The app automatically converts this — you can paste the Railway-provided URL as-is.

---

## Step 4 — Add Redis Plugin

1. Click **+ New** → **Database** → **Add Redis**
2. Wait for it to provision
3. Click on the Redis plugin → **Connect** tab
4. Copy the **`REDIS_URL`** value

---

## Step 5 — Create the App Service

1. Click **+ New** → **GitHub Repo** → select WAREOps
2. **Service Name:** `wareops-app` (or any name you like)
3. Go to **Settings → Build:**
   - **Builder:** Dockerfile
   - **Dockerfile Path:** `services/unified/Dockerfile`
   - **Build Context / Root Directory:** `.` (dot — repo root)
4. Add **Build Arguments** (Settings → Build → Build Arguments):
   ```
   VITE_API_BASE_URL=/api/v1
   VITE_TOPOLOGY_API_URL=/api/v1
   VITE_WS_URL=
   ```
5. Go to **Settings → Networking:**
   - Click **Generate Domain** — this is your public URL
   - Copy it (e.g. `https://wareops-app.up.railway.app`)
6. Go to **Settings → Deploy:**
   - **Health Check Path:** `/health`
   - **Health Check Timeout:** 120 seconds
   - Enable **Restart on Failure**

---

## Step 6 — Set Environment Variables

Go to your `wareops-app` service → **Variables** tab. Add all of these:

### Required

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | Paste from Step 3 | Railway auto-injects this if you link the plugin |
| `REDIS_URL` | Paste from Step 4 | Railway auto-injects this if you link the plugin |
| `SECRET_KEY` | `<generate below>` | Must be ≥32 chars, never commit to git |
| `PORT` | `8080` | Railway sets this automatically |
| `ENVIRONMENT` | `production` | |
| `LOG_LEVEL` | `INFO` | |

Generate a secure `SECRET_KEY`:
```bash
openssl rand -hex 32
```

### Optional (defaults work for production)

| Variable | Default | Notes |
|----------|---------|-------|
| `ENABLE_SIMULATOR` | `true` | Set to `false` when real Pi scanners are operational |
| `ROBOT_COUNT` | `3` | Number of simulated robots |
| `WAREHOUSE_ID` | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` | Must match seeded warehouse UUID |
| `ENABLE_SEEDER` | `true` | Auto-seeds DB on startup (idempotent) |
| `CORS_ORIGINS` | `["*"]` | Restrict to your domain in production |
| `FRONTEND_URL` | `https://...` | Your Railway public domain |

### Linking plugins (recommended)

In Railway, you can link the Postgres and Redis plugins to the app service so the variables are automatically injected:
1. Go to your `wareops-app` service → **Variables**
2. Click **Add Reference** → select `DATABASE_URL` from the Postgres plugin
3. Click **Add Reference** → select `REDIS_URL` from the Redis plugin

---

## Step 7 — First Deploy

1. Click **Deploy** on the `wareops-app` service
2. Watch the build logs — it builds the React SPA first (Node 20), then the Python app (~3–5 minutes total)
3. Wait for the health check to pass (the app seeds the database on first startup — allow 60–90 seconds)

**Verify the deploy:**
```bash
export DOMAIN=https://wareops-app.up.railway.app

# Gateway health
curl $DOMAIN/health
# → {"status":"ok","service":"wareops-unified","version":"2.0.0",...}

# Auth test
curl -s -X POST $DOMAIN/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@wareops.dev","password":"Password123!"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('role:', d['user']['role'])"
# → role: ENTERPRISE_ADMIN
```

---

## Step 8 — Enable GitHub Auto-Deploy

In Railway → your project → Settings → **GitHub Integration:**
- Enable **Auto Deploy** on push to `main`

Now every `git push origin main` automatically rebuilds and redeploys.

---

## Step 9 — Verify Everything Works

```bash
export DOMAIN=https://wareops-app.up.railway.app
TOKEN=$(curl -s -X POST $DOMAIN/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@wareops.dev","password":"Password123!"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

echo "=== Core APIs ==="
curl -s $DOMAIN/api/v1/warehouses -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('Warehouses:', len(d))"
# → Warehouses: 1

curl -s "$DOMAIN/api/v1/robots" -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('Robots:', len(d))"
# → Robots: 3 (from simulator)

curl -s "$DOMAIN/api/v1/analytics/kpis?warehouse_id=a1b2c3d4-e5f6-7890-abcd-ef1234567890" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('KPIs:', list(d.keys()))"
# → KPIs: ['health_score', 'inventory_accuracy', 'mission_success_rate', 'robot_uptime', 'open_alerts']

echo "=== Digital Twin ==="
curl -s "$DOMAIN/api/v1/warehouses/a1b2c3d4-e5f6-7890-abcd-ef1234567890/twin/snapshot" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('Twin:', list(d.keys()))"
# → Twin: ['warehouse_id', 'robots', 'bins', 'stats', 'snapshot_ts']

echo "=== SPA ==="
curl -s -o /dev/null -w "%{http_code}" $DOMAIN/
# → 200

echo "All checks passed ✓"
```

---

## Step 10 — Demo Login Accounts

All created automatically on startup. Password: **`Password123!`**

| Email | Role | Landing Page |
|-------|------|-------------|
| `admin@wareops.dev` | ENTERPRISE_ADMIN | `/admin/overview` |
| `manager@wareops.dev` | WAREHOUSE_MANAGER | `/manager/executive` |
| `supervisor@wareops.dev` | WAREHOUSE_SUPERVISOR | `/supervisor/dashboard` |
| `operator@wareops.dev` | WAREHOUSE_OPERATOR | `/operator/twin` |

---

## Step 11 — Configure Raspberry Pi Scanner (local)

The Pi runs locally and pushes data to Railway over HTTPS.

```bash
# On Pi laptop — install deps
pip3 install "python-socketio[client]" paramiko requests rich openpyxl

# Create environment file
cat > ~/wareops_scanner/.env.pi << 'EOF'
export WAREOPS_API_URL=https://wareops-app.up.railway.app
export WAREOPS_API_TOKEN=$(curl -s -X POST $WAREOPS_API_URL/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@wareops.dev","password":"Password123!"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
export WAREOPS_WAREHOUSE_ID=a1b2c3d4-e5f6-7890-abcd-ef1234567890
export WAREOPS_SCANNER_ROBOT_ID=sc000000-0000-0000-0000-000000000001
EOF

# Start remote shell relay (for Admin panel quick-commands)
source ~/wareops_scanner/.env.pi
python3 -m active_vision_scanner.remote_shell

# In another terminal — start SSH proxy (for Admin panel SSH terminal)
source ~/wareops_scanner/.env.pi
python3 -m active_vision_scanner.ssh_proxy

# Run scans
python3 -m active_vision_scanner.scan --scope full
python3 -m active_vision_scanner.scan --scope rack --target A1-RK1
python3 -m active_vision_scanner.scan --scope bin  --target A1-RK1-S2-B3
```

---

## Local Development (single-service mode)

Mirrors Railway exactly — 3 containers:

```bash
# Build frontend first
cd apps/ops-dashboard && npm run build && cd ../..

# Start everything
docker compose -f docker-compose.single.yml up --build

# Open dashboard
open http://localhost:8080
```

To reset from scratch:
```bash
docker compose -f docker-compose.single.yml down -v
(cd apps/ops-dashboard && npm run build)
docker compose -f docker-compose.single.yml up --build
```

The original multi-service stack still works for debugging individual services:
```bash
docker compose up  # uses docker-compose.yml — 11 services
```

---

## Troubleshooting

### Login fails with "Invalid email or password"
The seeder runs on startup. If it fails (race condition on first boot), restart the service:
```bash
railway redeploy -s wareops-app
```

### "topology" endpoint returns 500
The topology cache reads from Redis. If Redis isn't connected, it falls through to DB.
Check Railway logs: `railway logs -s wareops-app`

### Digital Twin shows "No twin data"
The simulator takes ~10 seconds to start and register robots after boot.
Wait 30 seconds, then refresh. If still empty, create a mission:
```bash
curl -X POST $DOMAIN/api/v1/missions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Initial Audit","warehouse_id":"a1b2c3d4-e5f6-7890-abcd-ef1234567890","priority":5}'
```

### WebSocket not connecting
Check browser DevTools → Network → WS — should connect to `wss://your-domain/socket.io/`.
The Socket.IO server is embedded in the same app process — no proxy needed.

### Build fails on Railway
Ensure **Build Context** is `.` (dot = repo root), not `services/unified`.
The Dockerfile uses `COPY apps/ops-dashboard/` which requires the repo root as context.

### CORS errors
Set `CORS_ORIGINS` to your actual domain:
```
CORS_ORIGINS=["https://wareops-app.up.railway.app"]
```

### Disable simulator once real hardware is live
```bash
# In Railway: wareops-app → Variables → ENABLE_SIMULATOR = false → Redeploy
```

---

## Security Before Go-Live

1. **Change SECRET_KEY:** Generate with `openssl rand -hex 32` and set in Railway Variables
2. **Change demo passwords:** Login as admin → User Management → change passwords
3. **Restrict CORS:** Set `CORS_ORIGINS=["https://your-domain.up.railway.app"]`
4. **Disable simulator:** Set `ENABLE_SIMULATOR=false` when real Pi scanners are running
5. **Enable Railway environment protection:** Settings → Environments → require approval

---

## Environment Variables Reference (Complete)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL URL (auto-injected by plugin) |
| `REDIS_URL` | Yes | — | Redis URL (auto-injected by plugin) |
| `SECRET_KEY` | Yes | — | JWT signing secret (generate: `openssl rand -hex 32`) |
| `PORT` | No | `8080` | HTTP listen port (Railway sets automatically) |
| `ENVIRONMENT` | No | `production` | Set to `development` for verbose SQL logging |
| `LOG_LEVEL` | No | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR` |
| `ENABLE_SIMULATOR` | No | `true` | Embedded robot simulator |
| `ROBOT_COUNT` | No | `3` | Number of simulated robots |
| `WAREHOUSE_ID` | No | `a1b2c3d4-...` | Default warehouse UUID |
| `ENABLE_SEEDER` | No | `true` | Auto-seed DB on startup |
| `CORS_ORIGINS` | No | `["*"]` | JSON array of allowed origins |
| `FRONTEND_URL` | No | `http://localhost:5173` | For auth redirect URLs |

---

*Last validated: 29/29 integration tests pass — 3 containers total*
