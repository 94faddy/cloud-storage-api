#!/bin/bash
# Path: stop.sh

APPNAME="cloud-storage-api"

echo "🛑 Stopping cloud storage api..."

pm2 delete $APPNAME 2>/dev/null

echo "✅ PM2 processes stopped."
