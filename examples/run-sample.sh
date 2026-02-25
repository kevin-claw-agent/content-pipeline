#!/bin/bash

# Content Pipeline Sample Episode Runner
# This script demonstrates how to create an episode and monitor its progress

set -e

# Configuration
API_URL="${API_URL:-http://localhost:3000}"
SAMPLE_FILE="examples/sample-episode.json"

echo "========================================="
echo "Content Pipeline - Sample Episode Runner"
echo "========================================="
echo ""

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed."
    echo "Install with: apt-get install jq  (Debian/Ubuntu)"
    echo "             : brew install jq      (macOS)"
    exit 1
fi

# Check if server is running
echo "Checking API server at $API_URL..."
if ! curl -s "$API_URL/health" > /dev/null; then
    echo "Error: API server is not running at $API_URL"
    echo "Please start the server with: npm run dev"
    exit 1
fi

echo "✓ API server is running"
echo ""

# Create episode
echo "Creating new episode from $SAMPLE_FILE..."
RESPONSE=$(curl -s -X POST "$API_URL/episodes" \
  -H "Content-Type: application/json" \
  -d @$SAMPLE_FILE)

# Check if creation was successful
if echo "$RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
    echo "Error creating episode:"
    echo "$RESPONSE" | jq '.'
    exit 1
fi

EPISODE_ID=$(echo "$RESPONSE" | jq -r '.id')
EPISODE_TITLE=$(echo "$RESPONSE" | jq -r '.title')

echo "✓ Episode created successfully!"
echo "  ID: $EPISODE_ID"
echo "  Title: $EPISODE_TITLE"
echo ""

# Monitor progress
echo "Monitoring episode progress..."
echo "Press Ctrl+C to stop monitoring"
echo ""

monitor_progress() {
    local episode_id=$1
    local attempt=0
    local max_attempts=60  # 5 minutes with 5-second intervals
    
    while [ $attempt -lt $max_attempts ]; do
        STATUS_RESPONSE=$(curl -s "$API_URL/episodes/$episode_id")
        
        EPISODE_STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.episode.status')
        JOBS=$(echo "$STATUS_RESPONSE" | jq -r '.jobs | length')
        ASSETS=$(echo "$STATUS_RESPONSE" | jq -r '.assets | length')
        
        # Clear line and print status
        echo -ne "\rStatus: $EPISODE_STATUS | Jobs: $JOBS | Assets: $ASSETS    "
        
        if [ "$EPISODE_STATUS" = "completed" ]; then
            echo ""
            echo ""
            echo "✓ Episode completed successfully!"
            return 0
        fi
        
        if [ "$EPISODE_STATUS" = "failed" ]; then
            echo ""
            echo ""
            echo "✗ Episode failed!"
            echo "$STATUS_RESPONSE" | jq '.'
            return 1
        fi
        
        sleep 5
        attempt=$((attempt + 1))
    done
    
    echo ""
    echo ""
    echo "Monitoring timed out. Episode is still processing."
    echo "You can check status manually with:"
    echo "  curl $API_URL/episodes/$episode_id | jq '.'"
    return 1
}

monitor_progress "$EPISODE_ID"

# Get final status
echo ""
echo "Final episode details:"
curl -s "$API_URL/episodes/$EPISODE_ID" | jq '{
  episode: .episode,
  job_summary: [.jobs[] | {stage: .stage, status: .status}],
  asset_count: (.assets | length),
  assets_by_type: [.assets[] | .type] | group_by(.) | map({type: .[0], count: length})
}'

echo ""
echo "========================================="
echo "Done! Episode ID: $EPISODE_ID"
echo "========================================="
