#!/bin/sh
# start.sh — Substitute environment variables into nginx config template, then start nginx.
# Runs inside the api-gateway container at boot time.
#
# On Railway, services communicate via *.railway.internal hostnames.
# On docker-compose, services communicate via their container service names.
#
# Required environment variables (with defaults for Railway internal DNS):
#   PORT                     — listen port  (Railway injects this automatically)
#   AUTH_SERVICE_HOST        — auth-service host:port
#   TOPOLOGY_SERVICE_HOST    — topology-service host:port
#   MISSION_SERVICE_HOST     — mission-service host:port
#   OBSERVATION_SERVICE_HOST — observation-service host:port
#   RECONCILIATION_SERVICE_HOST — reconciliation-service host:port
#   ALERTING_SERVICE_HOST    — alerting-service host:port
#   TWIN_SERVICE_HOST        — digital-twin-sync host:port

# Defaults for Railway internal networking
# Override these with docker-compose env vars for local dev
export PORT="${PORT:-8080}"
export AUTH_SERVICE_HOST="${AUTH_SERVICE_HOST:-auth-service.railway.internal:8000}"
export TOPOLOGY_SERVICE_HOST="${TOPOLOGY_SERVICE_HOST:-topology-service.railway.internal:8001}"
export MISSION_SERVICE_HOST="${MISSION_SERVICE_HOST:-mission-service.railway.internal:8002}"
export OBSERVATION_SERVICE_HOST="${OBSERVATION_SERVICE_HOST:-observation-service.railway.internal:8003}"
export RECONCILIATION_SERVICE_HOST="${RECONCILIATION_SERVICE_HOST:-reconciliation-service.railway.internal:8004}"
export ALERTING_SERVICE_HOST="${ALERTING_SERVICE_HOST:-alerting-service.railway.internal:8005}"
export TWIN_SERVICE_HOST="${TWIN_SERVICE_HOST:-digital-twin-sync.railway.internal:8006}"

# Substitute all variables into the nginx config
envsubst '${PORT} ${AUTH_SERVICE_HOST} ${TOPOLOGY_SERVICE_HOST} ${MISSION_SERVICE_HOST} ${OBSERVATION_SERVICE_HOST} ${RECONCILIATION_SERVICE_HOST} ${ALERTING_SERVICE_HOST} ${TWIN_SERVICE_HOST}' \
  < /etc/nginx/nginx.conf.template \
  > /etc/nginx/nginx.conf

echo "nginx config generated — listening on port ${PORT}"
echo "  auth       -> ${AUTH_SERVICE_HOST}"
echo "  topology   -> ${TOPOLOGY_SERVICE_HOST}"
echo "  mission    -> ${MISSION_SERVICE_HOST}"
echo "  obs        -> ${OBSERVATION_SERVICE_HOST}"
echo "  recon      -> ${RECONCILIATION_SERVICE_HOST}"
echo "  alerting   -> ${ALERTING_SERVICE_HOST}"
echo "  twin       -> ${TWIN_SERVICE_HOST}"

exec nginx -g "daemon off;"
