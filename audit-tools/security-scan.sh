#!/bin/bash

set -euo pipefail

PROJECT_DIR=$(pwd)
OUTPUT_DIR="$PROJECT_DIR/output"
IMAGE_NAME="nodegoat-app:latest"
VENV_DIR="$PROJECT_DIR/.scan-venv"

mkdir -p "$OUTPUT_DIR"

RISK_SCORE=0

# ─── Python venv setup (for nodejsscan) ──────────────────────────────────────
echo "================================================"
echo "SETUP: Python venv for nodejsscan"
echo "================================================"
if ! python3 -m venv "$VENV_DIR"; then
  echo "⚠ Failed to create venv — nodejsscan will be skipped"
  VENV_OK=false
else
  # shellcheck disable=SC1091
  source "$VENV_DIR/bin/activate"
  pip install --quiet --upgrade pip
  pip install --quiet nodejsscan
  VENV_OK=true
fi


echo "================================================"
echo "1/8 GITLEAKS (Secrets)"
echo "================================================"
gitleaks detect --source . \
  --report-format json \
  --report-path "$OUTPUT_DIR/gitleaks.json" || true


echo "================================================"
echo "2/8 TRIVY FS (Dependencies)"
echo "================================================"
trivy fs . \
  --format json \
  --severity HIGH,CRITICAL \
  --exit-code 1 \
  --output "$OUTPUT_DIR/trivy-fs.json" || RISK_SCORE=$((RISK_SCORE+25))


echo "================================================"
echo "3/8 TRIVY CONFIG (Misconfig)"
echo "================================================"
trivy config . \
  --format json \
  --severity HIGH,CRITICAL \
  --exit-code 1 \
  --output "$OUTPUT_DIR/trivy-config.json" || RISK_SCORE=$((RISK_SCORE+25))


echo "================================================"
echo "4/8 SEMGREP (SAST)"
echo "================================================"
semgrep --config=auto . \
  --json > "$OUTPUT_DIR/semgrep.json" || RISK_SCORE=$((RISK_SCORE+25))


echo "================================================"
echo "5/8 CONTAINER SCAN (Trivy Image)"
echo "================================================"
if [ -f "Dockerfile" ]; then
  echo "Dockerfile found → building image..."
  if docker build -t "$IMAGE_NAME" .; then
    echo "Build successful → scanning image"
    trivy image "$IMAGE_NAME" \
      --format json \
      --severity HIGH,CRITICAL \
      --exit-code 1 \
      --output "$OUTPUT_DIR/trivy-image.json" || RISK_SCORE=$((RISK_SCORE+25))
  else
    echo "Docker build failed → skipping scan"
    RISK_SCORE=$((RISK_SCORE+50))
  fi
else
  echo "No Dockerfile found → skipping container scan"
  echo "null" > "$OUTPUT_DIR/trivy-image.json"
fi


echo "================================================"
echo "6/8 NPM AUDIT (Known Vulnerabilities)"
echo "================================================"
if [ -f "package.json" ]; then
  # --json exits non-zero when vulns found; capture output regardless
  npm audit --json > "$OUTPUT_DIR/npm-audit.json" 2>&1 || true

  # Bump score if HIGH or CRITICAL advisories exist
  HIGH_COUNT=$(jq '[.vulnerabilities // {} | to_entries[].value
    | select(.severity == "high" or .severity == "critical")] | length' \
    "$OUTPUT_DIR/npm-audit.json" 2>/dev/null || echo 0)

  if [ "$HIGH_COUNT" -gt 0 ]; then
    echo "⚠ npm audit: $HIGH_COUNT high/critical vulnerability/ies found"
    RISK_SCORE=$((RISK_SCORE+25))
  else
    echo "✔ npm audit: no high/critical vulnerabilities"
  fi
else
  echo "No package.json found → skipping npm audit"
  echo "null" > "$OUTPUT_DIR/npm-audit.json"
fi


echo "================================================"
echo "7/8 KNIP (Dead Code / Unused Exports)"
echo "================================================"
if [ -f "package.json" ]; then
  # knip exits non-zero when issues found
  npx --yes knip --reporter json > "$OUTPUT_DIR/knip.json" 2>&1 || true
  echo "✔ knip scan complete (see output/knip.json)"
else
  echo "No package.json found → skipping knip"
  echo "null" > "$OUTPUT_DIR/knip.json"
fi


echo "================================================"
echo "8/9 NODEJSSCAN (Python SAST — venv)"
echo "================================================"
if [ "$VENV_OK" = true ]; then
  nodejsscan -d . -o "$OUTPUT_DIR/nodejsscan.json" || RISK_SCORE=$((RISK_SCORE+25))
  echo "✔ nodejsscan complete"
  deactivate
else
  echo "⚠ Skipped — venv not available"
  echo "null" > "$OUTPUT_DIR/nodejsscan.json"
fi


echo "================================================"
echo "9/9 BEARER (Privacy / OWASP SAST)"
echo "================================================"
if command -v bearer &>/dev/null; then
  bearer scan . \
    --format json \
    --output "$OUTPUT_DIR/bearer.json" \
    --severity critical,high \
    --exit-code 1 || RISK_SCORE=$((RISK_SCORE+25))
  echo "✔ bearer scan complete"
else
  echo "⚠ bearer not found — installing via curl..."
  curl -sfL https://raw.githubusercontent.com/Bearer/bearer/main/contrib/install.sh | sh -s -- -b /usr/local/bin
  bearer scan . \
    --format json \
    --output "$OUTPUT_DIR/bearer.json" \
    --severity critical,high \
    --exit-code 1 || RISK_SCORE=$((RISK_SCORE+25))
  echo "✔ bearer scan complete"
fi


echo "================================================"
echo "Generating unified report..."
echo "================================================"

jq -n \
  --slurpfile gitleaks     "$OUTPUT_DIR/gitleaks.json" \
  --slurpfile trivy_fs     "$OUTPUT_DIR/trivy-fs.json" \
  --slurpfile trivy_cfg    "$OUTPUT_DIR/trivy-config.json" \
  --slurpfile semgrep      "$OUTPUT_DIR/semgrep.json" \
  --slurpfile trivy_img    "$OUTPUT_DIR/trivy-image.json" \
  --slurpfile npm_audit    "$OUTPUT_DIR/npm-audit.json" \
  --slurpfile knip         "$OUTPUT_DIR/knip.json" \
  --slurpfile nodejsscan   "$OUTPUT_DIR/nodejsscan.json" \
  --slurpfile bearer       "$OUTPUT_DIR/bearer.json" \
  --arg score "$RISK_SCORE" \
  '{
    timestamp:    now,
    risk_score:   ($score | tonumber),
    gitleaks:     $gitleaks[0],
    trivy_fs:     $trivy_fs[0],
    trivy_config: $trivy_cfg[0],
    semgrep:      $semgrep[0],
    trivy_image:  $trivy_img[0],
    npm_audit:    $npm_audit[0],
    knip:         $knip[0],
    nodejsscan:   $nodejsscan[0],
    bearer:       $bearer[0]
  }' > "$OUTPUT_DIR/unified-report.json"


echo "================================================"
echo "DONE ✔"
echo "RISK SCORE: $RISK_SCORE / 100"
echo "================================================"

if [ "$RISK_SCORE" -ge 50 ]; then
  echo "❌ Security threshold breached"
  exit 1
fi
