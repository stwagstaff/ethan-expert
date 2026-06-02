#!/bin/bash
# Use Chrome headless to take a screenshot
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
URL="https://ethan-expert.pages.dev/"
OUTPUT="C:\\Users\\swags\\Documents\\ethan_expert\\site_screenshot.png"
OUTPUT_DIR="/c/Users/swags/Documents/ethan_expert"

mkdir -p "$OUTPUT_DIR"

# Chrome headless screenshot - outputs to a file in the current directory or specified path
"$CHROME" \
  --headless=new \
  --disable-gpu \
  --no-sandbox \
  --screenshot="$OUTPUT" \
  --window-size=1280,900 \
  --hide-scrollbars \
  --virtual-time-budget=5000 \
  "$URL"

EXIT_CODE=$?
if [ $EXIT_CODE -eq 0 ]; then
  echo "SUCCESS: $OUTPUT"
else
  echo "Chrome exited with code $EXIT_CODE"
  # Try alternative headless flag
  "$CHROME" \
    --headless \
    --disable-gpu \
    --no-sandbox \
    --screenshot="$OUTPUT" \
    --window-size=1280,900 \
    "$URL"
fi
