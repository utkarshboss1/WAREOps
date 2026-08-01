# WAREOps — Railway Production Deployment Guide

> **Architecture:** One Railway project, 10 services from a single GitHub monorepo.
> Each service has its own `railway.toml` and `Dockerfile`.

```
┌─────────────────────── RAILWAY PROJECT ───────────────────────────┐
│                                                                   │
│  [PostgreSQL]   [Redis]          ← Managed databases              │
│       │             │                                             │
│       ├─────────────┼──── auth-service        (port 8000)         │
│       ├─────────────┼──── topology-service     (port 8001)         │
│       ├─────────────┼──── mission-service      (port 8002)         │
│       ├─────────────┼──── observation-service   (port 8003)         │
│       ├─────────────┼──── reconciliation-service(port 8004)         │
│       ├─────────────┼──── alerting-service      (port 8005)         │
│       └─────────────┼──── digital-twin-sync     (port 8006)         │
│                     │                                             │
│                     └──── robot-simulator       (worker, no port)  │
│                                                                   │
│  [api-gateway]  ← nginx: proxies /api/* + serves React SPA        │
│       │            PUBLIC domain (only public-facing service)       │
│       │                                                            │
│  [ops-dashboard] ← (OPTIONAL: standalone SPA on its own domain)    │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

- A [Railway](https://railway.app) account (Hobby or Pro plan)
- Your `WAREOps` repo pushed to GitHub
- Railway CLI installed (optional): `npm i -g @railway/cli`

---

## Step 1 — Create the Railway Project

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click **New Project** → **Empty Project**
3. Name it `WAREOps`

---

## Step 2 — Add Managed Databases

Inside your Railway project:

1. Click **+ New** → **Database** → **Add PostgreSQL**
2. Click **+ New** → **Database** → **Add Redis**

Railway will auto-generate `DATABASE_URL` and `REDIS_URL` as reference variables.
You'll link these to each service in the next steps.

---

## Step 3 — Deploy the 7 Backend Microservices

For **each** of these 7 services, repeat the following:

| Service Name | Root Directory | Port |
|---|---|---|
| `auth-service` | `services/auth-service` | 8000 |
| `topology-service` | `services/topology-service` | 8001 |
| `mission-service` | `services/mission-service` | 8002 |
| `observation-service` | `services/observation-service` | 8003 |
| `reconciliation-service` | `services/reconciliation-service` | 8004 |
| `alerting-service` | `services/alerting-service` | 8005 |
| `digital-twin-sync` | `services/digital-twin-sync` | 8006 |

### For each service:

1. Click **+ New** → **GitHub Repo** → select your `WAREOps` repository
2. **IMPORTANT:** Railway will start building immediately from root — it will fail. That's OK.
3. Go to the service **Settings** tab:
   - **General → Service Name**: Rename to exactly the name in the table above (e.g., `auth-service`)
   - **Source → Root Directory**: Set to the path in the table above (e.g., `services/auth-service`)
   - **Config-as-code → Add File Path**: Set this to `<Root-Directory>/railway.toml` (e.g., `services/auth-service/railway.toml`). **IMPORTANT:** Root Directory does not change which railway.toml is used by default, so you must explicitly set this file path.
   - **Networking**: Railway will auto-assign a private domain like `auth-service.railway.internal`. **Do NOT generate a public domain** for backend services.
4. Go to the **Variables** tab:
   - Click **Add Reference** → select `DATABASE_URL` from PostgreSQL (for all services except `digital-twin-sync`)
   - Click **Add Reference** → select `REDIS_URL` from Redis
   - Add these manual variables:

### Per-service environment variables:

**auth-service:**
```
PORT=8000
SERVICE_NAME=auth-service
LOG_LEVEL=INFO
SECRET_KEY=<generate-a-strong-random-key>
FRONTEND_URL=https://<your-api-gateway-domain>.up.railway.app
```

**topology-service:**
```
PORT=8001
SERVICE_NAME=topology-service
LOG_LEVEL=INFO
```

**mission-service:**
```
PORT=8002
SERVICE_NAME=mission-service
LOG_LEVEL=INFO
TOPOLOGY_SERVICE_URL=http://topology-service.railway.internal:8001
```

**observation-service:**
```
PORT=8003
SERVICE_NAME=observation-service
LOG_LEVEL=INFO
TOPOLOGY_SERVICE_URL=http://topology-service.railway.internal:8001
ALERTING_SERVICE_URL=http://alerting-service.railway.internal:8005
```

**reconciliation-service:**
```
PORT=8004
SERVICE_NAME=reconciliation-service
LOG_LEVEL=INFO
TOPOLOGY_SERVICE_URL=http://topology-service.railway.internal:8001
```

**alerting-service:**
```
PORT=8005
SERVICE_NAME=alerting-service
LOG_LEVEL=INFO
```

**digital-twin-sync** (no DATABASE_URL needed — Redis only):
```
PORT=8006
SERVICE_NAME=digital-twin-sync
LOG_LEVEL=INFO
```

5. After setting Root Directory and variables, click **Deploy** to trigger a fresh build.

---

## Step 4 — Deploy the API Gateway

The api-gateway is special: it builds the React SPA and serves it alongside the nginx reverse proxy. Its Dockerfile lives at `infrastructure/nginx/Dockerfile` and needs access to both `infrastructure/nginx/` and `apps/ops-dashboard/`, so its **Root Directory must be `.` (repo root)**.

1. Click **+ New** → **GitHub Repo** → select `WAREOps`
2. Go to **Settings**:
   - **General → Service Name**: `api-gateway`
   - **Source → Root Directory**: `.` (leave empty / set to repo root)
   - **Config-as-code → Add File Path**: Set this to `infrastructure/nginx/railway.toml`
   - The `infrastructure/nginx/railway.toml` tells Railway to use `builder = "DOCKERFILE"` with `dockerfilePath = "infrastructure/nginx/Dockerfile"`
3. Go to **Networking** → **Generate Domain** → this creates your **public URL** (e.g., `api-gateway-production-xxxx.up.railway.app`)
4. Go to **Variables** and add:

```
PORT=8080
AUTH_SERVICE_HOST=auth-service.railway.internal:8000
TOPOLOGY_SERVICE_HOST=topology-service.railway.internal:8001
MISSION_SERVICE_HOST=mission-service.railway.internal:8002
OBSERVATION_SERVICE_HOST=observation-service.railway.internal:8003
RECONCILIATION_SERVICE_HOST=reconciliation-service.railway.internal:8004
ALERTING_SERVICE_HOST=alerting-service.railway.internal:8005
TWIN_SERVICE_HOST=digital-twin-sync.railway.internal:8006
```

> **Note:** Railway injects a `PORT` variable automatically. The nginx `start.sh` script uses it. If Railway sets `PORT` to something other than 8080, the container will listen on that port — this is fine, Railway routes traffic correctly regardless.

5. Trigger a deploy.

---

## Step 5 — Deploy the Robot Simulator (Optional)

The robot simulator generates fake robot telemetry for demo purposes.

1. Click **+ New** → **GitHub Repo** → select `WAREOps`
2. **Settings**:
   - **General → Service Name**: `robot-simulator`
   - **Source → Root Directory**: `apps/robot-simulator`
   - **Config-as-code → Add File Path**: Set this to `apps/robot-simulator/railway.toml`
   - **Networking**: Do NOT generate a public domain (it's a background worker)
3. **Variables**:
```
OBSERVATION_SERVICE_URL=http://observation-service.railway.internal:8003
MISSION_SERVICE_URL=http://mission-service.railway.internal:8002
TOPOLOGY_SERVICE_URL=http://topology-service.railway.internal:8001
ROBOT_COUNT=3
WAREHOUSE_ID=a1b2c3d4-e5f6-7890-abcd-ef1234567890
LOG_LEVEL=INFO
```

---

## Step 6 — Seed the Database

After all services are deployed and healthy, seed the warehouse data:

1. Go to your **PostgreSQL** service in Railway
2. Click **Data** tab → **Query**
3. Copy/paste the contents of `infrastructure/postgres/init.sql` and execute
4. Alternatively, use the Railway CLI:
   ```bash
   # Link to your project
   railway login
   railway link

   # Run the seed script against the production DB
   railway run python scripts/seed_warehouse_data.py
   ```

---

## Step 7 — Connect the Physical Robot Scanner

For your local ROS2 `active_vision_scanner` running on the laptop in the warehouse:

```bash
export WAREOPS_BACKEND_URL="https://<your-api-gateway-domain>.up.railway.app/api/v1"
export WAREOPS_WAREHOUSE_ID="a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

The `ScannerAPIBridge` will route observations, alerts, and heartbeats to this public endpoint.

For the remote shell listener:
```bash
export WAREOPS_API_URL="https://<your-api-gateway-domain>.up.railway.app"
export WAREOPS_WAREHOUSE_ID="a1b2c3d4-e5f6-7890-abcd-ef1234567890"
python -m active_vision_scanner.remote_shell
```

---

## Step 8 — Verify

1. Open your api-gateway public URL in a browser — you should see the WAREOps dashboard
2. Log in with one of the seeded demo accounts:
   | Email | Password | Role |
   |---|---|---|
   | `admin@wareops.io` | `Admin123!` | Enterprise Admin |
   | `manager@wareops.io` | `Manager123!` | Warehouse Manager |
   | `supervisor@wareops.io` | `Supervisor123!` | Warehouse Supervisor |
   | `operator@wareops.io` | `Operator123!` | Warehouse Operator |
3. Check the Digital Twin page — if the robot simulator is running, you should see live robot positions
4. Check **all service health endpoints** by visiting `https://<gateway>/api/v1/auth/health`, etc.

---

## Troubleshooting

### "Railpack could not determine how to build the app"
**Cause:** Root Directory is not set correctly, or the `railway.toml` is not being found.
**Fix:** Ensure each service's Root Directory in Settings points to the correct subdirectory (e.g., `services/auth-service`). You MUST also set **Config-as-code → Add File Path** explicitly for each service (e.g., `services/auth-service/railway.toml`), otherwise Railway defaults to the root directory which does not contain the correct configuration.

### Services can't reach each other
**Cause:** Internal DNS names don't match.
**Fix:** Ensure each Railway service is named **exactly** as listed in the table above. Railway generates internal DNS as `<service-name>.railway.internal`.

### Database connection errors
**Cause:** `DATABASE_URL` reference variable not linked.
**Fix:** In each service's Variables tab, click "Add Reference" and select `DATABASE_URL` from the PostgreSQL database.

### Build succeeds but deploy fails health check
**Cause:** The PORT env var doesn't match what the app listens on.
**Fix:** Make sure each service has `PORT` set in its variables matching the table above.

---

## Architecture Notes

- **No Kafka** — all event-driven communication uses Redis Pub/Sub
- **No public ports** on backend services — all traffic flows through the api-gateway
- **Socket.IO** WebSocket connections are proxied through nginx at `/socket.io/`
- **CORS** is handled at the nginx gateway level
- **Internal DNS** uses `<service-name>.railway.internal` for service-to-service communication
