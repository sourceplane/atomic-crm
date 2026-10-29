#!/usr/bin/env bash
# THE REBRAND WRITES EACH VALUE ONCE, AND WHAT IT WROTE STAYS WRITTEN.
#
# Drives the real tooling/rebrand/rebrand.mjs over one-file trees and compares
# the file. Each case is a shape this baseline's identity actually takes in the
# tree — the display name, the worker name, the Worker's own origin, the
# placeholder domain, a secret ref, the `repo` the Supabase project is named
# after — and each runs through as many passes as a bootstrap might make, so a
# value written once must survive every later pass unchanged. Two things must
# NOT be renamed although they spell the slug: the upstream template's own
# links (its name is this baseline's slug), and a migration (its checksum is
# in the manifest and in every database it was applied to).
#
# The identity is PINNED (fixtures/baseline-identity.atomic-crm.json) rather
# than read from .baseline/identity.json: what this tests is the engine, and
# its fixtures spell the identity out literally.
#
# Needs: node, git. No network.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
rebrand="$here/../tooling/rebrand/rebrand.mjs"
identity="$here/fixtures/baseline-identity.atomic-crm.json"

fail=0
# check NAME VALUES-JSON FILE CONTENT WANT [PASSES]
check() {
  local name="$1" values="$2" file="$3" content="$4" want="$5" passes="${6:-1}"
  local tmp got out i
  tmp="$(mktemp -d)"
  git -C "$tmp" init -q
  mkdir -p "$tmp/$(dirname "$file")" "$tmp/.rebrand"
  printf '%s\n' "$content" > "$tmp/$file"
  printf '%s\n' "$values" > "$tmp/.rebrand/values.json"
  for ((i = 1; i <= passes; i++)); do
    git -C "$tmp" add -A
    if ! out="$(cd "$tmp" && node "$rebrand" --baseline-identity "$identity" --values .rebrand/values.json --allow-dirty 2>&1)"; then
      echo "   ✕  $name: rebrand pass $i failed:" >&2
      printf '%s\n' "$out" | sed 's/^/        /' >&2
      fail=1
      rm -rf "$tmp"
      return
    fi
  done
  got="$(cat "$tmp/$file")"
  rm -rf "$tmp"
  if [ "$got" = "$want" ]; then
    echo "   ok  $name"
  else
    echo "   ✕  $name:" >&2
    echo "        got:  $got" >&2
    echo "        want: $want" >&2
    fail=1
  fi
}

acme='{"reponame":"acme-crm","productname":"Acme Clients","productdomain":"acme.dev","githuborg":"acme-inc","subdomain":"acme","orunWorkspace":"ws_79BDXAZQ"}'

echo "── rebrand: the product's own identity"
check "the app's default title is the product's" \
  "$acme" apps/web/src/components/crm/root/defaultConfiguration.ts 'export const defaultTitle = "Atomic CRM";' \
  'export const defaultTitle = "Acme Clients";' 3
check "a name with an apostrophe and an ampersand stays a valid string" \
  '{"reponame":"acme-crm","productname":"Sam'"'"'s Leads & Deals","githuborg":"acme-inc"}' \
  apps/web/src/components/crm/root/defaultConfiguration.ts 'export const defaultTitle = "Atomic CRM";' \
  'export const defaultTitle = "Sam'"'"'s Leads & Deals";' 3
check "the page title" \
  "$acme" apps/web/index.html '    <title>Atomic CRM</title>' '    <title>Acme Clients</title>' 3
check "the installable app's name" \
  "$acme" apps/web/public/manifest.json '  "short_name": "Atomic CRM",' '  "short_name": "Acme Clients",' 3
check "the sign-up page, in both languages" \
  "$acme" apps/web/src/components/crm/providers/commons/frenchCrmMessages.ts '      welcome_title: "Bienvenue sur Atomic CRM",' \
  '      welcome_title: "Bienvenue sur Acme Clients",' 3
check "but not the demo's card about the template" \
  "$acme" apps/web/src/components/crm/dashboard/Welcome.tsx '        , Atomic CRM is fully open-source. You can find the code at{" "}' \
  '        , Atomic CRM is fully open-source. You can find the code at{" "}' 3
check "nor the template where the prose names it" \
  "$acme" apps/web/component.yaml "  description: The CRM — Marmelab's Atomic CRM single-page app" \
  "  description: The CRM — Marmelab's Atomic CRM single-page app" 3
check "the worker name" \
  "$acme" apps/web/component.yaml 'workerName: atomic-crm-web' \
  'workerName: acme-crm-web'
check "the Worker's origin Supabase Auth is pointed at" \
  "$acme" infra/terraform/supabase/component.yaml '    workersDevSubdomain: your-workers-subdomain' \
  '    workersDevSubdomain: acme'
check "the product domain" \
  "$acme" intent.yaml '      BASE_DOMAIN: atomic-crm.example.com' \
  '      BASE_DOMAIN: acme.dev'
check "no domain given: the reserved placeholder, named after the product" \
  '{"reponame":"acme-crm","productname":"Acme Clients","githuborg":"acme-inc","subdomain":"acme"}' \
  intent.yaml '      BASE_DOMAIN: atomic-crm.example.com' \
  '      BASE_DOMAIN: acme-crm.example.com'
check "an empty domain is no domain" \
  '{"reponame":"acme-crm","productname":"Acme Clients","productdomain":""}' \
  intent.yaml '      BASE_DOMAIN: atomic-crm.example.com' \
  '      BASE_DOMAIN: acme-crm.example.com'
check "the root package" \
  "$acme" package.json '  "name": "atomic-crm",' \
  '  "name": "acme-crm",'
check "the repo the Supabase project is named after" \
  "$acme" intent.yaml '        repo: atomic-crm' \
  '        repo: acme-crm'
check "the fixture's Hyperdrive name" \
  "$acme" apps/web/wiring.fixture.json '    "hyperdrive_name": "stg-atomic-crm-stage"' \
  '    "hyperdrive_name": "stg-acme-crm-stage"'
check "a secret ref, workspace and project" \
  "$acme" apps/web/component.yaml \
  '    SUPABASE_SERVICE_ROLE_KEY: "secret://atomic-crm/atomic-crm/{{ .environment }}/SUPABASE_SERVICE_ROLE_KEY"' \
  '    SUPABASE_SERVICE_ROLE_KEY: "secret://ws_79BDXAZQ/acme-crm/{{ .environment }}/SUPABASE_SERVICE_ROLE_KEY"'
check "this repository's source link" \
  "$acme" README.md 'See https://github.com/sourceplane/atomic-crm.' \
  'See https://github.com/acme-inc/acme-crm.'
check "the MCP server's name" \
  "$acme" apps/web/worker/functions/mcp/taskListUi.ts 'export const TASK_LIST_UI_URI = "ui://atomic-crm/task-list";' \
  'export const TASK_LIST_UI_URI = "ui://acme-crm/task-list";'

echo "── rebrand: what spells the slug but is not the product's"
check "the template's repository" \
  "$acme" apps/web/src/components/crm/dashboard/Welcome.tsx '          href="https://github.com/marmelab/atomic-crm"' \
  '          href="https://github.com/marmelab/atomic-crm"'
check "the template's site" \
  "$acme" apps/web/src/components/crm/dashboard/Welcome.tsx '          href="https://marmelab.com/atomic-crm"' \
  '          href="https://marmelab.com/atomic-crm"'
check "the template's telemetry endpoint" \
  "$acme" apps/web/src/components/crm/root/CRM.tsx \
  '    img.src = `https://atomic-crm-telemetry.marmelab.com/atomic-crm-telemetry?domain=${window.location.hostname}`;' \
  '    img.src = `https://atomic-crm-telemetry.marmelab.com/atomic-crm-telemetry?domain=${window.location.hostname}`;'
check "the template's release history" \
  "$acme" apps/web/CHANGELOG.md '* Add a build-lib command to publish an atomic-crm node module' \
  '* Add a build-lib command to publish an atomic-crm node module'
check "a migration (its checksum is in every database it reached)" \
  "$acme" packages/db/src/migrations/20990101000000_x/up.sql '-- atomic-crm: a comment the checksum covers' \
  '-- atomic-crm: a comment the checksum covers'

echo "── rebrand: a product named after the baseline is renamed once, and stays"
contains='{"reponame":"atomic-crm-2","productname":"Atomic CRM 2","productdomain":"atomic-crm.example.com.au","githuborg":"sourceplane","subdomain":"your-workers-subdomain-2"}'
check "a slug containing the baseline's" \
  "$contains" package.json '  "name": "atomic-crm",' \
  '  "name": "atomic-crm-2",' 3
check "a worker name containing the baseline's" \
  "$contains" apps/web/component.yaml 'workerName: atomic-crm-web' \
  'workerName: atomic-crm-2-web' 3
check "a domain containing the baseline's" \
  "$contains" intent.yaml 'BASE_DOMAIN: atomic-crm.example.com' \
  'BASE_DOMAIN: atomic-crm.example.com.au' 3
check "a subdomain containing the baseline's placeholder" \
  "$contains" infra/terraform/supabase/component.yaml '    workersDevSubdomain: your-workers-subdomain' \
  '    workersDevSubdomain: your-workers-subdomain-2' 3
check "a display name containing the baseline's" \
  "$contains" apps/web/src/components/crm/root/defaultConfiguration.ts 'export const defaultTitle = "Atomic CRM";' \
  'export const defaultTitle = "Atomic CRM 2";' 3

# --verify runs after every rebrand. Without the product's values it cannot
# tell the product's own identity from a leftover; with them it can. A real
# leftover must fail it either way.
verify() { # NAME VALUES FILE CONTENT WANT(pass|fail) [--values]
  local name="$1" values="$2" file="$3" content="$4" want="$5" withvalues="${6:-}" tmp got
  tmp="$(mktemp -d)"
  git -C "$tmp" init -q
  mkdir -p "$tmp/$(dirname "$file")" "$tmp/.rebrand"
  printf '%s\n' "$content" > "$tmp/$file"
  printf '%s\n' "$values" > "$tmp/.rebrand/values.json"
  git -C "$tmp" add -A
  if (cd "$tmp" && node "$rebrand" --baseline-identity "$identity" --verify ${withvalues:+--values .rebrand/values.json} >/dev/null 2>&1); then got=pass; else got=fail; fi
  rm -rf "$tmp"
  if [ "$got" = "$want" ]; then echo "   ok  $name"; else echo "   ✕  $name: --verify ${got}ed, want $want" >&2; fail=1; fi
}
echo "── rebrand --verify: the product's own identity is not residue"
verify "given the values, a slug containing the baseline's passes" \
  "$contains" package.json '"name": "atomic-crm-2"' pass --values
verify "without them it cannot know, and fails" \
  "$contains" package.json '"name": "atomic-crm-2"' fail
verify "given the values, a real leftover still fails" \
  "$acme" package.json '"name": "atomic-crm"' fail --values
verify "a leftover worker name fails" \
  "$acme" apps/web/component.yaml 'workerName: atomic-crm-web' fail --values
verify "a leftover code identifier fails (no rule renames it — so nothing may spell it)" \
  "$acme" apps/web/src/x.ts 'export class AtomicCrm {}' fail --values
verify "the upstream template's links are not residue" \
  "$acme" apps/web/src/components/crm/dashboard/Welcome.tsx '          marmelab/atomic-crm' pass --values
verify "the telemetry endpoint is not residue" \
  "$acme" apps/web/src/components/crm/root/CRM.tsx '`https://atomic-crm-telemetry.marmelab.com/atomic-crm-telemetry?domain=`' pass --values
verify "a clean product passes" \
  "$acme" package.json '"name": "acme-crm"' pass --values

echo "── rebrand: a residue it cannot rename fails the rebrand itself"
tmp="$(mktemp -d)"; git -C "$tmp" init -q; mkdir -p "$tmp/.rebrand" "$tmp/apps/web"
printf '%s\n' "$acme" > "$tmp/.rebrand/values.json"
printf 'const x = "ATOMIC_CRM_TOKEN"\n' > "$tmp/apps/web/x.ts"
git -C "$tmp" add -A
if (cd "$tmp" && node "$rebrand" --baseline-identity "$identity" --values .rebrand/values.json --allow-dirty >/dev/null 2>&1); then
  echo "   ✕  an unrenamable env-var prefix passed the rebrand" >&2; fail=1
else
  echo "   ok  an unrenamable env-var prefix fails the rebrand, naming the file"
fi
rm -rf "$tmp"

[ "$fail" -eq 0 ] || exit 1
echo "rebrand.test.sh: ok"
