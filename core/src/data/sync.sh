#!/usr/bin/env bash
# Usage: ./fetch_releases.sh <owner> <repo> <output_dir>
# Requires: GITHUB_TOKEN env var set

set -euo pipefail

OWNER="${1:?Usage: $0 <owner> <repo> <output_dir>}"
REPO="${2:?}"
OUTPUT_DIR="${3:?}"
TOKEN="${GITHUB_TOKEN:?GITHUB_TOKEN env var not set}"

mkdir -p "$OUTPUT_DIR"

PAGE=1
PER_PAGE=100

while true; do
  RESPONSE=$(curl -s -f \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/${OWNER}/${REPO}/releases?per_page=${PER_PAGE}&page=${PAGE}")

  COUNT=$(echo "$RESPONSE" | jq 'length')
  if [[ "$COUNT" -eq 0 ]]; then
    break
  fi

  while read -r release; do
    TAG=$(echo "$release" | jq -r '.tag_name')
    PUBLISHED_AT=$(echo "$release" | jq -r '.published_at')
    HTML_URL=$(echo "$release" | jq -r '.html_url')

    FILE="${OUTPUT_DIR}/${TAG}.yml"

    cat > "$FILE" <<EOF
version: "${TAG}"
release_date: "${PUBLISHED_AT}"
url: "${HTML_URL}"
EOF

    echo "Written: $FILE"
  done < <(echo "$RESPONSE" | jq -c '.[]')

  (( PAGE++ ))
done