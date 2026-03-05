#!/bin/bash
# =============================================================
#  B-Look Full Redeploy Script  (SQLite / Zero-PostgreSQL mode)
#  Usage: bash deploy.sh
# =============================================================
set -euo pipefail

# ─── Configuration ────────────────────────────────────────────
RG_NAME="blook-prod-rg"
ACR_NAME="blookregistry10314"
APP_NAME="blook-api-10314"
STORAGE_ACCOUNT="blookweb10314"

# Optional: override SECRET_KEY; defaults to a stable hash if unset.
# Strongly recommended to set your own:
#   export SECRET_KEY="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
SECRET_KEY="${SECRET_KEY:-}"

echo ""
echo "======================================================"
echo "  B-Look Redeploy — $(date '+%Y-%m-%d %H:%M:%S')"
echo "======================================================"

# ─── 1. BUILD FRONTEND ────────────────────────────────────────
echo ""
echo "▶ [1/5] Building frontend..."
cd ~/Documents/GitHub/B-Look/frontend
rm -rf dist
npm install
npm run build
echo "✅ Frontend built."

# ─── 2. UPLOAD FRONTEND TO AZURE STATIC WEBSITE ──────────────
echo ""
echo "▶ [2/5] Uploading frontend to Azure Static Website..."

az storage blob delete-batch \
  --source '$web' \
  --account-name "$STORAGE_ACCOUNT"

az storage blob upload-batch \
  -s ./dist \
  -d '$web' \
  --account-name "$STORAGE_ACCOUNT" \
  --overwrite

# SPA deep-link routing: /pay/<uuid> must serve index.html, not 404
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

# Use the committed Dockerfile (app.main:app, no Dockerfile.stable)
TAG="prod-$(date '+%Y%m%d%H%M')"
az acr build \
  --registry "$ACR_NAME" \
  --image "blook-backend:${TAG}" \
  --image "blook-backend:latest" \
  -f Dockerfile \
  .

echo "✅ Image built and pushed to ACR (tag: ${TAG})."

# ─── 4. CONFIGURE APP SERVICE ENVIRONMENT VARIABLES ──────────
echo ""
echo "▶ [4/5] Configuring App Service settings..."

# Build the SECRET_KEY setting line
if [[ -z "$SECRET_KEY" ]]; then
  echo "⚠️  SECRET_KEY not set — using a default. Set export SECRET_KEY=<value> for production."
  SK_SETTING='SECRET_KEY=change-me-set-a-real-secret-key-in-production'
else
  SK_SETTING="SECRET_KEY=${SECRET_KEY}"
fi

az webapp config appsettings set \
  --resource-group "$RG_NAME" \
  --name "$APP_NAME" \
  --settings \
    "DATABASE_URL=sqlite:////home/blook_prod.db" \
    "STATIC_DIR=/home/static" \
    "CORS_ORIGINS=https://${STORAGE_ACCOUNT}.z23.web.core.windows.net" \
    "WEBSITES_PORT=8000" \
    "WEBSITES_ENABLE_APP_SERVICE_STORAGE=true" \
    "TZ=Asia/Bangkok" \
    "$SK_SETTING"

echo "✅ App Service settings updated."

# ─── 5. DEPLOY IMAGE & RESTART ───────────────────────────────
echo ""
echo "▶ [5/5] Deploying new image..."

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
echo "  Frontend:  https://${STORAGE_ACCOUNT}.z23.web.core.windows.net"
echo "  Backend:   https://${APP_NAME}.azurewebsites.net"
echo "  API Docs:  https://${APP_NAME}.azurewebsites.net/docs"
echo ""
echo "💾 SQLite DB lives at /home/blook_prod.db (persistent — survives restarts)"
echo "🖼️  Uploaded files live at /home/static/{slips,mockups} (persistent)"
echo "======================================================"


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
