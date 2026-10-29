#!/usr/bin/env bash
# Render the product's LIVE-DEPLOYMENT documentation from verified state.
# Called by phase 02-docs as a `run:` hook (and safe to run by hand, from the
# product's checkout). Idempotent: the generated file and the README section
# are fully re-rendered on every run, so re-running after a redeploy, a custom
# domain or connecting inbound email refreshes them.
#
#   hooks/render-deployment-docs.sh <out> <workspace> <baseline-dir>
#
# What it writes (in <out>):
#   ai/context/deployment.md   — REGENERATED: URLs with live probe results
#                                (the CRM, its health and wiring, whether
#                                inbound email is connected yet), identity, and the secrets
#                                the deployment uses BY NAME
#   ai/context/operations.md   — healed from the baseline's copy if absent
#                                (the static operating contract; never rewritten)
#   README.md                  — the section between <!-- 02-docs:begin/end -->
#                                is replaced (appended after the title if the
#                                README predates the markers)
#
# No secret VALUE is ever read or written here — secrets are named, not read.
#
# IT ASKS THE PLATFORM NOTHING. The record used to carry the workspace's slug,
# its secrets listed per rung and its integrations — five CLI calls, one after
# another, from the build box — and all of it is what the console shows live
# and this file could only show as it was the day it was written. The record
# keeps what the repository is the right place for: the identity the code
# names, what answered at the URLs, and where to look for the rest.
set -euo pipefail

out="${1:?usage: render-deployment-docs.sh <out> <workspace> <baseline-dir>}"
ws="${2:-}"
L="${3:?usage: render-deployment-docs.sh <out> <workspace> <baseline-dir>}"

cd "$out"
vals=".rebrand/values.json"
[ -f "$vals" ] || { echo "render-docs: $vals missing — is this a bootstrapped product?" >&2; exit 1; }
val() { python3 -c "import json,sys;print(json.load(open('$vals')).get(sys.argv[1],'') or '')" "$1"; }

repo="$(val reponame)"
brand="$(val brandSlug)"; [ -n "$brand" ] || brand="$repo"
sub="$(val subdomain)"; [ -n "$sub" ] || sub="your-workers-subdomain"
[ -n "$ws" ] || ws="$(sed -n 's/^[[:space:]]*workspace:[[:space:]]*\([^[:space:]#]*\).*/\1/p' intent.yaml | head -1)"
[ -n "$ws" ] || ws="?"

# CI lane pin (what version the deploy lanes run).
lanepin="$(sed -n 's/^ *version: *\(v[0-9.]*\) *$/\1/p' .github/workflows/ci.yml 2>/dev/null | head -1)"
[ -n "$lanepin" ] || lanepin="?"

# curl emits the -w format even on connection failure (000) — capture, don't
# append, or a failed probe reads "000000".
probe() { local c; c="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$1" 2>/dev/null)" || true; printf '%s' "${c:-000}"; }
badge() { case "$1" in 2*|3*) echo "LIVE ($1)" ;; 000) echo "unreachable" ;; *) echo "answering $1" ;; esac; }

stage_url="https://${brand}-web-stage.${sub}.workers.dev"
prod_url="https://${brand}-web-prod.${sub}.workers.dev"

# How the Worker is wired, as it reports it: /api/health answers
# {"ok":true,"supabase":…,"database":…,"admin":…} — the Supabase project, the
# Hyperdrive binding, the service-role key the admin functions need.
health_state() {
  local body code
  body="$(mktemp)"
  code="$(curl -s -o "$body" -w '%{http_code}' --max-time 20 "$1/api/health" 2>/dev/null)" || true
  code="${code:-000}"
  if [ "$code" != 200 ]; then echo "unknown (/api/health $(badge "$code"))"
  else python3 -c 'import json,sys
d=json.load(open(sys.argv[1]))
print(", ".join(k + (" yes" if d.get(k) else " NO") for k in ("supabase","database","admin")))' "$body" 2>/dev/null || echo "unreadable"
  fi
  rm -f "$body"
}

# Whether inbound email (Postmark) is connected yet: its route answers 503
# until the environment's Worker has the three POSTMARK_WEBHOOK_* secrets
# (the README's "Optional services"), and refuses an unlisted caller (401)
# once it does.
inbound_state() {
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 -X POST "$1/functions/v1/postmark" 2>/dev/null)" || true
  case "${code:-000}" in
    503) echo "not connected — see README, Optional services" ;;
    401|403|405) echo "connected" ;;
    *) echo "unknown (/functions/v1/postmark $(badge "${code:-000}"))" ;;
  esac
}

rows=""
for pair in "stage|$stage_url" "prod|$prod_url"; do
  env="${pair%%|*}"; url="${pair#*|}"
  rows+="| CRM (${env}) | ${url} | $(badge "$(probe "$url/")") |"$'\n'
  rows+="| health (${env}) | ${url}/api/health | $(badge "$(probe "$url/api/health")") |"$'\n'
done
wired_stage="$(health_state "$stage_url")"; wired_prod="$(health_state "$prod_url")"
inbound_stage="$(inbound_state "$stage_url")"; inbound_prod="$(inbound_state "$prod_url")"

now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Heal the static operating contract when the product predates it.
mkdir -p ai/context
if [ ! -f ai/context/operations.md ] && [ -f "$L/ai/context/operations.md" ]; then
  cp "$L/ai/context/operations.md" ai/context/operations.md
  git add ai/context/operations.md 2>/dev/null || true
  node "$L/tooling/rebrand/rebrand.mjs" --values "$vals" --allow-dirty >/dev/null 2>&1 || true
  echo "render-docs: healed ai/context/operations.md"
fi

cat > ai/context/deployment.md <<EOF
# ${repo} — live deployment manifest

> GENERATED by the \`02-docs\` phase on ${now}; re-run it to refresh
> (idempotent; see [operations.md](operations.md)). Hand-edits here are
> overwritten. No secret values appear in this file — secrets are named only.

## Identity

| | |
|---|---|
| repository / project slug | \`${repo}\` |
| Orun workspace | \`${ws}\` |
| declared in | \`intent.yaml\` → \`execution.state.workspace\` |
| Workers | \`${brand}-web-stage\`, \`${brand}-web-prod\` on \`${sub}.workers.dev\` |
| CI lane CLI pin | orun \`${lanepin}\` (\`.github/workflows/ci.yml\`) |

## Public URLs (probed ${now})

| surface | URL | status |
|---|---|---|
${rows}
The \`dev\` environment is verify-only by design — no deployed URL.

## Wiring (as the Worker reports it)

| environment | Supabase project, database (Hyperdrive), service-role key |
|---|---|
| stage | ${wired_stage} |
| prod | ${wired_prod} |

## Inbound email

| environment | Postmark |
|---|---|
| stage | ${inbound_stage} |
| prod | ${inbound_prod} |

Postmark is not a provider the platform brokers: its webhook credentials are
Orun secrets the owner adds per environment (README, "Optional services").
Everything else — sign-up, contacts, deals, tasks, notes — works without them.

## Secrets (names only)

| secret | where | what it is |
|---|---|---|
| \`CLOUDFLARE_API_TOKEN\` | the workspace | BROKERED from its Cloudflare connection (\`workers-deploy\`): deploys the CRM's Worker and stores its Worker secrets |
| \`CLOUDFLARE_HYPERDRIVE_TOKEN\` | the workspace | BROKERED (\`hyperdrive-edit\`): applies the Hyperdrive config — the deploy token cannot touch Hyperdrive |
| \`CLOUDFLARE_ACCOUNT_ID\` | the workspace | the Cloudflare connection's account id — a fact, not a credential |
| \`SUPABASE_ACCESS_TOKEN\` | the workspace | BROKERED from its Supabase connection (\`management-access\`): creates the project and runs the migrations |
| \`SUPABASE_ORG_ID\` | the workspace | the Supabase connection's organization id — a fact, not a credential |
| \`SUPABASE_PROJECT_REF\`, \`SUPABASE_DB_PASSWORD\`, \`SUPABASE_DB_URL\` | \`${repo}\` on stage and on prod | written by the Supabase root's apply: the project's ref, its database password and its connection URL, read by Hyperdrive and the migrations |
| \`WIRING_SUPABASE\` | \`${repo}\` on stage and on prod | written by the Supabase root's apply: the project's URL and publishable key, which the build inlines — public by design |
| \`SUPABASE_SERVICE_ROLE_KEY\` | \`${repo}\` on stage and on prod | written by the Supabase root's apply; the deploy stores it on the Worker as a Worker secret for the admin functions — never in the bundle |
| \`WIRING_CLOUDFLARE_HYPERDRIVE\` | \`${repo}\` on stage and on prod | written by the Hyperdrive root's apply: the config's id and name, not a credential |
| \`POSTMARK_WEBHOOK_USER\`, \`POSTMARK_WEBHOOK_PASSWORD\`, \`POSTMARK_WEBHOOK_AUTHORIZED_IPS\`, \`VITE_INBOUND_EMAIL\` | \`${repo}\`, per environment, when the owner adds them | optional: inbound email (above) |

Brokered secrets are minted per run, so no long-lived value is at rest.
What the workspace holds right now (every secret by name, and its integrations and
their health) is on the console's Secrets and Integrations pages for
\`${ws}\`.

## How this deployment changes

Merges to \`main\` converge automatically: CI plans the changed components and
runs each lane with \`orun run --remote-state\` against the workspace above.
See [operations.md](operations.md) for the full operating contract.
EOF
echo "render-docs: wrote ai/context/deployment.md"

python3 - <<'PY'
import re
begin, end = "<!-- 02-docs:begin -->", "<!-- 02-docs:end -->"
body = f"""{begin}
This product is **live**. Verified URLs, identity, how the Worker is wired,
whether inbound email is connected and the secrets it uses are recorded in
[ai/context/deployment.md](ai/context/deployment.md) (re-rendered by the
`02-docs` phase); how it deploys and how to operate it:
[ai/context/operations.md](ai/context/operations.md).
{end}"""
s = open("README.md").read()
if begin in s and end in s:
    s = re.sub(re.escape(begin) + r".*?" + re.escape(end), lambda _m: body, s, count=1, flags=re.S)
else:
    lines = s.splitlines(keepends=True)
    at = 1
    while at < len(lines) and lines[at].strip() == "":
        at += 1
    lines.insert(at, f"\n## Live deployment\n\n{body}\n")
    s = "".join(lines)
open("README.md", "w").write(s)
print("render-docs: README live-deployment section rendered")
PY
echo "render-docs: done"
