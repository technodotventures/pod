#!/bin/bash
# Pod Vite UI — launched by pm2. PATH is pinned so pm2's spawn
# environment doesn't need the user's login shell.
# Use Homebrew Node 26 to match the backend / the project's runtime.
export PATH="/opt/homebrew/bin:$PATH"
cd "/Users/stevieghiassi/dev/coffee-pod" || exit 1
exec node ./node_modules/.bin/vite
