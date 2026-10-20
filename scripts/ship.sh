#!/usr/bin/env bash
# Push the current commit to the phone as an EAS update (channel "preview").
# Only JS/asset changes travel this way; the runtime fingerprint keeps an update
# away from an APK whose native side does not match, which then needs a new build.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "ship: uncommitted changes — commit first, so the update matches a commit." >&2
  exit 1
fi

npm run typecheck
npm run lint
npx jest --silent

message="$(git log -1 --format='%s') ($(git rev-parse --short HEAD) on $(git branch --show-current))"
npx -y eas-cli@25.2.0 update \
  --channel preview \
  --environment preview \
  --platform android \
  --message "$message" \
  --non-interactive
