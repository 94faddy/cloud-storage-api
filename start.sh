#!/bin/bash
# Path: start.sh

APPNAME="cloud-storage-api"

echo "🛑 Stopping old PM2 processes if running..."
pm2 delete $APPNAME 2>/dev/null

echo "📦 Building Next.js..."
npm run build

echo "🚀 Starting cloud storage api..."
pm2 start npm --name "$APPNAME" -- start

echo "💾 Saving PM2 process list..."
pm2 save

echo "✅ System started with PM2!"

echo -e "\n📜 Opening logs for $APPNAME...\n"
pm2 logs $APPNAME
