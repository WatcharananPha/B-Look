#!/bin/bash
# =============================================================
#  B-Look Full Redeploy Script
#  Usage: bash deploy.sh
# =============================================================
set -euo pipefail

# ─── Configuration ────────────────────────────────────────────
RG_NAME="blook-prod-rg"
ACR_NAME="blookregistry10314"
APP_NAME="blook-api-10314"                          # Azure App Service (backend)
STORAGE_ACCOUNT="blookweb10314"                     # Azure Storage Account (frontend SPA)

# ── Secrets / connection strings (set or export before running) ──
# DATABASE_URL  — PostgreSQL connection string from Azure Database for PostgreSQL
# SECRET_KEY    — JWT signing secret (long random string, keep it secret)
# CORS_ORIGINS  — comma-separated list of allowed origins (e.g. the Static Website URL)
: "${DATABASE_URL:?❌  DATABASE_URL must be exported before running this script}"
: "${SECRET_KEY:?❌   SECRET_KEY must be exported before running this script}"
: "${CORS_ORIGINS:?❌  CORS_ORIGINS must be exported before running this script}"
# Example (run these in your terminal before executing this script):
#   export DATABASE_URL="postgresql+psycopg2://blookadmin:StrongP%40ssw0rd123%21@blook-db-10314.postgres.database.azure.com:5432/blook_db?sslmode=require"
#   export SECRET_KEY="<generate with: python3 -c 'import secrets; print(secrets.token_hex(32))'>"
#   export CORS_ORIGINS="https://blookweb10314.z23.web.core.windows.net"

echo ""
echo "======================================================"
echo "  B-Look Redeploy — $(date '+%Y-%m-%d %H:%M:%S')"
echo "======================================================"

# ─── 1. BUILD FRONTEND ────────────────────────────────────────
echo ""
echo "▶ [1/5] Building frontend..."
cd ~/Documents/GitHub/B-Look/frontend
rm -rf dist

# .env.production is already committed with correct values.
# Override only if you need a different API URL at build time.
# Vite embeds VITE_* vars at build time from .env.production.

npm install
npm run build
echo "✅ Frontend built."

# ─── 2. UPLOAD FRONTEND TO AZURE STATIC WEBSITE ──────────────
echo ""
echo "▶ [2/5] Uploading frontend to Azure Static Website..."

# Delete all blobs in $web container first
az storage blob delete-batch \
  --source '$web' \
  --account-name "$STORAGE_ACCOUNT"

# Upload built dist folder
az storage blob upload-batch \
  -s ./dist \
  -d '$web' \
  --account-name "$STORAGE_ACCOUNT" \
  --overwrite

# FIX #5: Configure 404 → index.html so /pay/<uuid> deep links work in the SPA
az storage blob service-properties update \
  --account-name "$STORAGE_ACCOUNT" \
  --static-website \
  --index-document "index.html" \
  --404-document "index.html"

echo "✅ Frontend uploaded."

# ─── 3. BUILD BACKEND DOCKER IMAGE ───────────────────────────
echo ""
echo "▶ [3/5] Building backend Docker image..."
cd ~/Documents/GitHub/B-Look/backend

# FIX #1: Use the existing Dockerfile (CMD already has app.main:app — correct)
# Do NOT create a new Dockerfile.stable — main_stable.py has been deleted.
az acr build \
  --registry "$ACR_NAME" \
  --image "blook-backend:prod-$(date '+%Y%m%d%H%M')" \
  --image "blook-backend:latest" \
  -f Dockerfile \
  .
echo "✅ Image built and pushed to ACR."

# ─── 4. CONFIGURE APP SERVICE ENVIRONMENT VARIABLES ──────────
echo ""
echo "▶ [4/5] Setting App Service environment variables..."

# FIX #2 & #3: Inject DATABASE_URL & SECRET_KEY so they override the dev defaults
# FIX #7: Lock CORS_ORIGINS to the specific static website origin instead of "*"
az webapp config appsettings set \
  --resource-group "$RG_NAME" \
  --name "$APP_NAME" \
  --settings \
    DATABASE_URL="$DATABASE_URL" \
    SECRET_KEY="$SECRET_KEY" \
    CORS_ORIGINS="$CORS_ORIGINS" \
    WEBSITES_PORT=8000 \
    TZ="Asia/Bangkok"

echo "✅ App Service settings updated."

# ─── 5. DEPLOY IMAGE & RESTART ───────────────────────────────
echo ""
echo "▶ [5/5] Deploying new image to App Service..."

az webapp config container set \
  --name "$APP_NAME" \
  --resource-group "$RG_NAME" \
  --container-image-name "${ACR_NAME}.azurecr.io/blook-backend:latest"

az webapp restart \
  --resource-group "$RG_NAME" \
  --name "$APP_NAME"

echo ""
echo "======================================================"
echo "✅ Deployment complete!"
echo ""
echo "  Frontend (SPA):  https://${STORAGE_ACCOUNT}.z23.web.core.windows.net"
echo "  Backend API:     https://${APP_NAME}.azurewebsites.net/api/v1"
echo "  API Docs:        https://${APP_NAME}.azurewebsites.net/docs"
echo ""
echo "⚠️  IMPORTANT — Static file persistence (FIX #4):"
echo "   Uploaded slips and mockups live inside the container."
echo "   Mount an Azure File Share to /app/static via:"
echo "   Portal → App Service → Configuration → Path mappings → Azure Storage"
echo "   Share path: /app/static | Storage type: Azure Files"
echo "   (Only needed once — files survive redeploys after this is set up)"
echo "======================================================"
