#!/bin/bash
# Pod backend — launched by pm2. PATH is pinned so pm2's spawn
# environment doesn't need the user's login shell.
# MUST use Homebrew Node 26 — the native better-sqlite3 binary is compiled for
# it (NODE_MODULE_VERSION 147). Node 22 (.local/.hermes) fails with
# ERR_DLOPEN_FAILED. /opt/homebrew/bin goes FIRST in PATH.
export PATH="/opt/homebrew/bin:$PATH"
cd "/Users/stevieghiassi/dev/coffee-pod" || exit 1
# Run WITHOUT `tsx watch` — pm2 is the supervisor. tsx's own file-watch
# restarting fights pm2 and causes a restart storm. After editing backend
# source, run: pm2 restart coffee-pod-api
#
# Call the local tsx binary DIRECTLY under Node 26 (not `npx`/`npm exec`) —
# npx can hang on npm's cache lock when several invocations stack up.
exec node ./node_modules/.bin/tsx --env-file=.env src/server.ts
