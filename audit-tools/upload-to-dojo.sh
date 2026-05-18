#!/bin/bash

# Configuration settings
TOKEN="REMOVED"
DOJO_URL="http://localhost:8080/api/v2/import-scan/"
ENGAGEMENT_ID="2"  # Change this to your actual Engagement ID

# Array mapping local files to their native DefectDojo scan types
declare -A SCANS
SCANS["output/gitleaks.json"]="Gitleaks Scan"
SCANS["output/semgrep.json"]="Semgrep JSON Report"
SCANS["output/trivy-fs.json"]="Trivy Scan"
SCANS["output/trivy-config.json"]="Trivy Scan"
SCANS["output/trivy-image.json"]="Trivy Scan"
SCANS["output/npm-audit.json"]="NPM Audit Scan"
SCANS["output/nodejsscan.json"]="NodeJsScan Scan"
SCANS["output/bearer.json"]="Bearer CLI"
# knip has no native DefectDojo parser — uploaded as a generic findings import
SCANS["output/knip.json"]="Generic Findings Import"


echo "================================================="
echo "Starting Bulk Scan Upload to DefectDojo..."
echo "================================================="

for FILE in "${!SCANS[@]}"; do
    SCAN_TYPE="${SCANS[$FILE]}"

    # Skip files that are null (tool was skipped during scan)
    if [ -f "$FILE" ] && [ "$(cat "$FILE")" = "null" ]; then
        echo "⏭  Skipping $FILE: tool was not run (null output)."
        echo "-------------------------------------------------"
        continue
    fi

    if [ -f "$FILE" ]; then
        echo "🚀 Uploading $FILE as '$SCAN_TYPE'..."

        RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X 'POST' "$DOJO_URL" \
          -H "Authorization: Token $TOKEN" \
          -H "Content-Type: multipart/form-data" \
          -F "scan_type=$SCAN_TYPE" \
          -F "active=true" \
          -F "verified=false" \
          -F "minimum_severity=Info" \
          -F "engagement=$ENGAGEMENT_ID" \
          -F "file=@$FILE")

        if [ "$RESPONSE" == "201" ]; then
            echo "✅ Successfully imported $FILE"
        else
            echo "❌ Failed to import $FILE (HTTP Status: $RESPONSE)"
        fi
    else
        echo "⚠️  Skipping $FILE: File not found."
    fi
    echo "-------------------------------------------------"
done

echo "================================================="
echo "Bulk upload complete! Check your DefectDojo dashboard."
echo "================================================="
