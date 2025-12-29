#!/bin/bash

# Test Fixtures Download Script
# Downloads public domain media files for e2e testing

set -e

FIXTURES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$FIXTURES_DIR"

echo "📥 Downloading test fixtures..."

# Big Buck Bunny - 5 second clip (720p)
# Source: https://test-videos.co.uk/bigbuckbunny/mp4-h264
if [ ! -f "big-buck-bunny-720p-5s.mp4" ]; then
  echo "  → big-buck-bunny-720p-5s.mp4"
  curl -L -o "big-buck-bunny-720p-5s.mp4" \
    "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4"
fi

# Sintel trailer (480p) - longer clip for timeline testing
if [ ! -f "sintel-trailer-480p.mp4" ]; then
  echo "  → sintel-trailer-480p.mp4"
  curl -L -o "sintel-trailer-480p.mp4" \
    "https://test-videos.co.uk/vids/sintel/mp4/h264/480/Sintel_480_10s_1MB.mp4"
fi

# Small test video for quick tests (360p, 1s)
if [ ! -f "test-video-360p-1s.mp4" ]; then
  echo "  → test-video-360p-1s.mp4"
  curl -L -o "test-video-360p-1s.mp4" \
    "https://www.w3schools.com/html/mov_bbb.mp4"
fi

# Test audio - simple tone for audio track testing
if [ ! -f "test-audio.mp3" ]; then
  echo "  → test-audio.mp3"
  # Using a small public domain audio sample
  curl -L -o "test-audio.mp3" \
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" \
    --max-time 10 2>/dev/null || echo "    (audio download skipped - using fallback)"
fi

echo ""
echo "✅ Test fixtures ready!"
echo ""
ls -lh *.mp4 *.mp3 2>/dev/null || echo "No media files found"

