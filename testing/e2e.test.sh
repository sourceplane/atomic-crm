#!/usr/bin/env bash
# TIER 2 — the CRM a bootstrap produces builds, migrates, deploys (dry),
# serves, and does what its functions promise, against a Supabase-shaped
# database.
#
# placement.test.sh proves the tree a bootstrap ends with is the right tree,
# and that its own plan converges in the right order. This proves it WORKS,
# by doing to it what its own pipelines will:
#
#   1. at the 01-product landing (the commit its PR merges), install with the
#      lockfile the product ships, render the wrangler fixture (which must
#      change nothing: the render is committed), typecheck, lint, test (the
#      app's tests in Chromium, as upstream runs them), build. The landing is
#      checked in the build box with `orun validate` and `orun plan` alone
#      (`checks: local`), and its PR runs `plan` alone, so THIS is where a
#      product those steps refuse is caught: before the tag;
#   2. a Postgres of its own on a random port, shaped as a new Supabase
#      project is (testing/lib/local-postgres.sh, then the preamble the
#      product's own tests/db uses: the Data API's roles and Supabase's
#      default privileges, auth.users and auth.uid(), the storage tables, the
#      extensions schema) — `postgres` a login role WITHOUT superuser or
#      BYPASSRLS — and a stand-in for the ONE Supabase Management API
#      endpoint the migration runner calls (testing/lib/fake-supabase-api.py);
#   3. the db-migrate lane's own steps, rendered by `orun plan` for a push to
#      main and run IN THE TREE THE RUNNER STAGES for the job: install, build
#      @saas/db, apply — upstream's migration history, its seed and the
#      port's outbox — then apply again, which must apply nothing, and the
#      pull-request profile's offline plan;
#   4. the web lane's own steps for stage, rendered for a pull request and
#      run in its staged job tree: install, `verify-app-structure` (the
#      committed wrangler.jsonc must exist BEFORE the build), `build-app` —
#      which re-renders the config from the stage wiring documents it is
#      handed, as the deploy does, and inlines the project into the bundle —
#      then `verify-build-output` and `deploy-dry-run`;
#   5. the built Worker under `wrangler dev`, its HYPERDRIVE binding pointed
#      at that Postgres and its Supabase a stand-in for the slice of Auth and
#      Storage the functions call (testing/lib/fake-supabase.py, its tokens
#      signed by testing/lib/jwt.mjs), and the component's OWN `smokeCommand`
#      against it, verbatim; then what the product promises: the app under
#      its own name, the health check, a signed-out caller refused, the first
#      account an administrator, a password reset sent, two contacts merged
#      as the signed-in user (row-level security, through Hyperdrive), the
#      MCP server reading the schema as that user, inbound email answering
#      503 unconfigured, and a deleted note's attachments queued, then
#      removed from Storage by the Cron Trigger;
#   6. the Data API's view of the same database: every table in `public` has
#      row-level security, `anon` reads none of what was written, and
#      auth.users' emails and the attachments queue are closed to both API
#      roles.
#
# What it cannot do is the platform's half: create the repository, mint the
# brokered tokens, create a real Supabase project and Hyperdrive config
# (Terraform is validated, not applied, in this repository), deploy for real
# and probe workers.dev. That is a bootstrap against a workspace
# (BOOTSTRAP.md); everything short of it is here.
#
# Needs: orun, node, pnpm, python3 (+PyYAML), git, curl, psql and a
# PostgreSQL server install (initdb, pg_ctl), and the network for
# `pnpm install` and Playwright's Chromium (or a warm store). A few minutes.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/.." && pwd)"
# shellcheck source=lib/bootstrap.sh
source "$here/lib/bootstrap.sh"
# shellcheck source=lib/local-postgres.sh
source "$here/lib/local-postgres.sh"

for bin in orun node pnpm python3 git curl psql; do
  command -v "$bin" >/dev/null || { echo "e2e.test.sh needs $bin on PATH" >&2; exit 1; }
done
pg_bin >/dev/null || { echo "e2e.test.sh needs a PostgreSQL server install (initdb, pg_ctl)" >&2; exit 1; }

scratch="$(mktemp -d)"
pgdir="$(mktemp -d)"
dev_pid=""
api_pid=""
sb_pid=""
# wrangler dev runs under pnpm, node and two workerd processes; a TERM to the
# first does not reach the rest, and waiting on it then never returns. So each
# server is started as its own process group (setsid) and the group stopped.
stop_group() {
  local pid="$1"
  [ -n "$pid" ] || return 0
  kill -TERM -- "-$pid" 2>/dev/null || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do kill -0 -- "-$pid" 2>/dev/null || break; sleep 0.5; done
  kill -KILL -- "-$pid" 2>/dev/null || true
}
cleanup() {
  stop_group "$dev_pid"
  stop_group "$api_pid"
  stop_group "$sb_pid"
  pg_down "$pgdir"
  [ -n "$pgdir" ] && [ -d "$pgdir" ] && rm -rf "$pgdir"
  [ -n "$scratch" ] && [ -d "$scratch" ] && rm -rf "$scratch"
}
trap cleanup EXIT
free_port() { python3 -c "import socket;s=socket.socket();s.bind(('127.0.0.1',0));print(s.getsockname()[1]);s.close()"; }
values="$here/fixtures/acme.json"
repo="$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['reponame'])" "$values")"
export CI=1 WRANGLER_SEND_METRICS=false TURBO_TELEMETRY_DISABLED=1

# The landing's own checks, step for step — what the product's Checks
# workflow ran on a pull request before the product carried ci.yml alone —
# run here at once on the whole tree.
LANDING_CHECKS=(
  "pnpm install --frozen-lockfile"
  "pnpm run wire:fixture"
  "pnpm typecheck"
  "pnpm lint"
  "pnpm test"
  "pnpm build"
)
checks() { # DIR LOG
  local dir="$1" log="$2" cmd
  for cmd in "${LANDING_CHECKS[@]}"; do
    echo "   \$ $cmd" | tee -a "$log"
    if ! (cd "$dir" && bash -c "$cmd") >> "$log" 2>&1; then
      echo "FAIL: \`$cmd\` failed in $dir" >&2; tail -40 "$log" >&2; return 1
    fi
  done
}

# One job of a plan, written out as the runner would run it: each `run:` step
# (the `use:` actions are setup-node and setup-pnpm, which this machine has)
# as a numbered script, the job's env, and the component path the steps run
# in. Steps are picked BY ID when given, else every `run:` step in order.
extract_job() { # PLAN JOB-ID OUT-DIR [STEP-ID…]
  python3 - "$@" <<'PY'
import json, pathlib, sys
plan, jid, out, *want = sys.argv[1:]
job = next((j for j in json.load(open(plan))["jobs"] if j["id"] == jid), None)
if job is None:
    sys.exit(f"the plan has no job {jid}")
out = pathlib.Path(out); out.mkdir(parents=True)
steps = [s for s in job["steps"] if s.get("run")]
if want:
    by = {s["id"]: s for s in steps}
    missing = [w for w in want if w not in by]
    if missing:
        sys.exit(f"{jid} has no step(s) {missing}")
    steps = [by[w] for w in want]
for i, s in enumerate(steps):
    (out / f"{i:02d}.sh").write_text(s["run"])
    (out / f"{i:02d}.id").write_text(s["id"])
(out / "path").write_text(job.get("path") or ".")
with (out / "env").open("w") as f:
    for k, v in (job.get("env") or {}).items():
        f.write(f"export {k}={json.dumps(v)}\n")
PY
}
run_job() { # STEPS-DIR WORK-TREE ENV LOG-PREFIX
  local steps="$1" work="$2" envname="$3" logp="$4" s id
  for s in "$steps"/[0-9][0-9].sh; do
    id="$(cat "${s%.sh}.id")"
    echo "   ▸ $id"
    if ! (cd "$work/$(cat "$steps/path")" && source "$steps/env" && export ORUN_ENVIRONMENT="$envname" \
          && bash -e "$s") > "$logp-$id.log" 2>&1; then
      echo "FAIL: the lane's $id step" >&2; tail -40 "$logp-$id.log" >&2; return 1
    fi
  done
}

echo "── the offline bootstrap (testing/lib/bootstrap.sh)"
tree="$scratch/$repo"
bootstrap_offline "$root" "$tree" "$values" "$scratch/logs" > "$scratch/bootstrap.log" 2>&1 || {
  echo "FAIL: the offline bootstrap stopped" >&2; tail -40 "$scratch/bootstrap.log" >&2; exit 1; }
echo "   2 phases placed and landed"

# ── 1. the product's own pull request ──────────────────────────────────────
echo "── 01-product's landing: install, the fixture render, typecheck, lint, test, build"
s01="$(git -C "$tree" rev-parse HEAD~1)"
at01="$scratch/at-01/$repo"
git -C "$tree" worktree add -q "$at01" "$s01"
checks "$at01" "$scratch/checks.log"
dirty="$(git -C "$at01" status --porcelain)"
[ -z "$dirty" ] || { echo "FAIL: the checks changed tracked files — the committed wrangler.jsonc is not the fixture render:" >&2; echo "$dirty" >&2; exit 1; }
tests_line="$(sed 's/\x1b\[[0-9;]*m//g' "$scratch/checks.log" | grep -oE "Tests +[0-9]+ passed[^)]*\)" | tr -s ' ' | paste -sd ';' -)"
echo "   the checks left the tree as committed; ${tests_line:-tests: ?}"

# ── 2. a Supabase-shaped database, and the one API the migration runner calls ─
echo "── a local Postgres shaped as a Supabase project, and the Management API stand-in"
pgport="$(free_port)"
pgurl="$(pg_up "$pgdir" "$pgport")" || { echo "FAIL: Postgres did not start" >&2; exit 1; }
admin="postgres://supabase_admin@127.0.0.1:$pgport/postgres"
psql "$admin" -X -q -v ON_ERROR_STOP=1 -f "$tree/tests/db/src/fixtures/supabase-shape.sql" > "$scratch/shape.log" 2>&1 \
  || { echo "FAIL: the Supabase-shaped preamble" >&2; cat "$scratch/shape.log" >&2; exit 1; }
api_port="$(free_port)"
ref="localproject"
setsid python3 "$here/lib/fake-supabase-api.py" "$api_port" "$pgurl" --ref "$ref" > "$scratch/api.log" 2>&1 < /dev/null &
api_pid=$!
for _ in $(seq 1 30); do curl -s -o /dev/null "http://127.0.0.1:$api_port/" && break; sleep 0.3; done
echo "   $pgurl (auth, storage, the API roles); the API on :$api_port"

# The two plans the lanes below run from, each in the product's own tree: a
# push to main at the 01-product commit (the db-migrate lane's APPLY profile),
# and a pull request over the finished product against an empty base (the web
# lane's VERIFY profile, which carries deploy-dry-run, and db-migrate's PLAN).
(cd "$at01" && orun plan --intent intent.yaml --trigger github-push-main --env stage --output "$scratch/plan-main.json") > "$scratch/plan-main.log" 2>&1 \
  || { echo "FAIL: orun plan (push to main)" >&2; tail -15 "$scratch/plan-main.log" >&2; exit 1; }
git -C "$tree" worktree remove --force "$at01"
mkdir -p "$scratch/pr"
git clone -q "$tree" "$scratch/pr/$repo"
prtree="$scratch/pr/$repo"
git -C "$prtree" checkout -q --orphan empty
git -C "$prtree" rm -rqf .
git -C "$prtree" -c user.email=t@example.invalid -c user.name=t commit -qm empty --allow-empty
git -C "$prtree" checkout -q main
(cd "$prtree" && orun plan --intent intent.yaml --trigger github-pull-request --base empty --head HEAD --env stage \
   --output "$scratch/plan-pr.json") > "$scratch/plan-pr.log" 2>&1 \
  || { echo "FAIL: orun plan (pull request)" >&2; tail -15 "$scratch/plan-pr.log" >&2; exit 1; }
python3 - "$scratch/plan-pr.json" <<'PY'
import json, sys
jobs = {j["component"]: j for j in json.load(open(sys.argv[1]))["jobs"] if j["environment"] == "stage"}
chain = ["supabase", "cloudflare-hyperdrive", "db-migrate", "web"]
for a, b in zip(chain, chain[1:]):
    ja, jb = jobs[a], jobs[b]
    if ja["id"] in (jb.get("dependsOn") or []) or ja["id"] not in (jb.get("advisoryDependsOn") or []):
        sys.exit(f"FAIL: on a pull request {b}@stage must name {a}@stage as advisory, not wait on it")
print("   pull request: " + " → ".join(chain) + ", every edge advisory")
PY

# ── 3. the db-migrate lane, in its staged job tree ─────────────────────────
echo "── the stage db-migrate lane: install, build @saas/db, apply — then apply again, and the PR's plan"
extract_job "$scratch/plan-main.json" db-migrate.stage.migrate "$scratch/steps-migrate" \
  install-dependencies build-db-package "Migration Apply"
extract_job "$scratch/plan-main.json" db-migrate.stage.migrate "$scratch/steps-migrate-again" "Migration Apply"
extract_job "$scratch/plan-pr.json" db-migrate.stage.migrate "$scratch/steps-migrate-plan" "Migration Plan"
mwork="$prtree/.orun/runs/e2e/db-migrate.stage.migrate/work"
python3 "$here/lib/stage-job.py" "$prtree" "$mwork"
export SUPABASE_ACCESS_TOKEN=e2e-token SUPABASE_PROJECT_REF="$ref" SUPABASE_DB_PASSWORD=postgres \
       SUPABASE_DB_URL="$pgurl" SUPABASE_API_URL="http://127.0.0.1:$api_port"
run_job "$scratch/steps-migrate" "$mwork" stage "$scratch/migrate"
applied() { python3 -c "import json,sys;t=open(sys.argv[1]).read();print(' '.join(json.loads(t[t.index('{'):t.rindex('}')+1])['applied']))" "$1"; }
want="$(grep -oE 'id: "[^"]+"' "$tree/packages/db/src/manifest.ts" | cut -d'"' -f2 | paste -sd ' ' -)"
[ -n "$want" ] && [ "$(applied "$scratch/migrate-Migration Apply.log")" = "$want" ] \
  || { echo "FAIL: the first apply applied '$(applied "$scratch/migrate-Migration Apply.log")', not '$want'" >&2; exit 1; }
echo "   applied all $(echo "$want" | wc -w) migrations: the control migration, upstream's history, its seed, the outbox"
run_job "$scratch/steps-migrate-again" "$mwork" stage "$scratch/migrate-again"
[ -z "$(applied "$scratch/migrate-again-Migration Apply.log")" ] \
  || { echo "FAIL: a second apply applied '$(applied "$scratch/migrate-again-Migration Apply.log")'" >&2; exit 1; }
echo "   a second apply applied nothing (the ledger holds $(psql "$pgurl" -XAtc 'select count(*) from _migrations.applied') migrations)"
[ "$(psql "$pgurl" -XAtc "select id || ':' || public from storage.buckets")" = "attachments:true" ] \
  || { echo "FAIL: no public attachments bucket" >&2; exit 1; }
[ "$(psql "$pgurl" -XAtc "select count(*) from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal")" = 2 ] \
  || { echo "FAIL: the triggers on auth.users that make a user a sales row are missing" >&2; exit 1; }
echo "   the attachments bucket and the triggers on auth.users are in place"
run_job "$scratch/steps-migrate-plan" "$mwork" stage "$scratch/migrate-plan"
[ "$(applied "$scratch/migrate-plan-Migration Plan.log")" = "$want" ] \
  || { echo "FAIL: the pull request's offline plan did not verify every migration" >&2; exit 1; }
echo "   the pull request's plan step verifies every migration's checksum offline"
unset SUPABASE_ACCESS_TOKEN SUPABASE_PROJECT_REF SUPABASE_DB_PASSWORD SUPABASE_DB_URL SUPABASE_API_URL
rm -rf "$mwork"

# ── 4. the web lane's steps, for stage ─────────────────────────────────────
echo "── the stage web lane: install, verify-app-structure, build-app, verify-build-output, deploy-dry-run"
extract_job "$scratch/plan-pr.json" web.stage.verify-deploy "$scratch/steps-web" \
  install-workspace-dependencies verify-app-structure build-app verify-build-output deploy-dry-run
work="$prtree/.orun/runs/e2e/web.stage.verify-deploy/work"
python3 "$here/lib/stage-job.py" "$prtree" "$work"
[ ! -e "$work/apps/web/dist" ] && [ -f "$work/apps/web/wrangler.jsonc" ] \
  || { echo "FAIL: the staged tree is not a fresh checkout with the committed wrangler.jsonc" >&2; exit 1; }
echo "   staged: $(realpath --relative-to="$prtree" "$work") — no build output, the committed wrangler.jsonc"
# The stand-in Supabase the Worker will call, and the stage wiring documents
# as the two roots publish them and the lane resolves them (secretEnv).
sb_port="$(free_port)"
sb_url="http://127.0.0.1:$sb_port"
mkdir -p "$scratch/keys"
node "$here/lib/jwt.mjs" keys "$scratch/keys"
hd_id="e2e0000000000000000000000000c0de"
export WIRING_SUPABASE_STAGE="{\"supabase_url\":\"$sb_url\",\"supabase_anon_key\":\"sb_publishable_e2e\"}"
export WIRING_CLOUDFLARE_HYPERDRIVE_STAGE="{\"hyperdrive_id\":\"$hd_id\",\"hyperdrive_name\":\"stg-$repo-stage\"}"
export SUPABASE_SERVICE_ROLE_KEY_STAGE=e2e-service-role
run_job "$scratch/steps-web" "$work" stage "$scratch/web"
unset WIRING_SUPABASE_STAGE WIRING_CLOUDFLARE_HYPERDRIVE_STAGE SUPABASE_SERVICE_ROLE_KEY_STAGE
grep -q "\"id\": \"$hd_id\"" "$work/apps/web/wrangler.jsonc" && grep -q "\"SUPABASE_URL\": \"$sb_url\"" "$work/apps/web/wrangler.jsonc" \
  || { echo "FAIL: build-app did not re-render wrangler.jsonc from the stage wiring documents" >&2; exit 1; }
grep -lq "$sb_url" "$work"/apps/web/dist/assets/*.js \
  || { echo "FAIL: the bundle does not carry the stage project the config names" >&2; exit 1; }
grep -q "worker-secrets: no Cloudflare credential" "$scratch/web-build-app.log" \
  || { echo "FAIL: build-app did not hand the Worker its secrets (or pushed them from a verify lane)" >&2; exit 1; }
if grep -lq "e2e-service-role" "$work"/apps/web/dist/assets/*.js "$work/apps/web/wrangler.jsonc" 2>/dev/null; then
  echo "FAIL: the service-role key reached the bundle or the config" >&2; exit 1
fi
size="$(grep -oE 'Total Upload: [0-9.]+ KiB / gzip: [0-9.]+ KiB' "$scratch/web-deploy-dry-run.log" | head -1)"
echo "   built bound to the stage project and Hyperdrive id it was handed; the service-role key in neither"
echo "   the bundle nor the config; ${size:-dry run}"

# ── 5. serve it ────────────────────────────────────────────────────────────
echo "── wrangler dev over the built Worker: HYPERDRIVE on the local Postgres, Supabase the stand-in"
[ ! -e "$work/apps/web/.dev.vars" ] || { echo "FAIL: the staged tree carries a .dev.vars" >&2; exit 1; }
sblog="$scratch/supabase-calls.jsonl"
: > "$sblog"
setsid python3 "$here/lib/fake-supabase.py" "$sb_port" "$scratch/keys/jwks.json" "$sblog" > "$scratch/sb.log" 2>&1 < /dev/null &
sb_pid=$!
port="$(free_port)"
(cd "$work/apps/web" && CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="$pgurl" \
   exec setsid pnpm exec wrangler dev --config wrangler.jsonc --ip 127.0.0.1 --port "$port" \
   --name "$repo-web-stage" --var SUPABASE_SERVICE_ROLE_KEY:e2e-service-role --test-scheduled \
   --show-interactive-dev-session=false) > "$scratch/dev.log" 2>&1 < /dev/null &
dev_pid=$!
url="http://127.0.0.1:$port"
for _ in $(seq 1 90); do
  curl -s -o /dev/null "$url/" && break
  kill -0 "$dev_pid" 2>/dev/null || { echo "FAIL: wrangler dev exited" >&2; tail -30 "$scratch/dev.log" >&2; exit 1; }
  sleep 1
done
curl -s -o /dev/null "$url/" || { echo "FAIL: wrangler dev never answered" >&2; tail -30 "$scratch/dev.log" >&2; exit 1; }

echo "   ▸ the component's own smokeCommand, DEPLOYED_URL=$url"
smoke="$(python3 -c "import yaml,sys;print(yaml.safe_load(open(sys.argv[1]))['spec']['parameters']['smokeCommand'])" "$tree/apps/web/component.yaml")"
DEPLOYED_URL="$url" bash -c "$smoke" || { echo "FAIL: the deploy's smoke refused the product" >&2; tail -20 "$scratch/dev.log" >&2; exit 1; }

echo "   ▸ what the CRM promises"
python3 "$here/lib/e2e-flows.py" "$url" "$values" "$admin" "$scratch/keys" "$here/lib/jwt.mjs" "$sb_url" "$sblog" \
  || { echo "FAIL: the flows; wrangler dev said:" >&2; tail -40 "$scratch/dev.log" >&2; exit 1; }

# ── 6. what Supabase's Data API would see ──────────────────────────────────
echo "── the Data API's roles (anon, authenticated) against the same database"
psql "$pgurl" -X -q -v ON_ERROR_STOP=1 -At > "$scratch/rls.out" 2> "$scratch/rls.err" <<'SQL' \
  || { echo "FAIL: the row-level security checks" >&2; cat "$scratch/rls.err" >&2; exit 1; }
SELECT 'app role: superuser=' || rolsuper || ' bypassrls=' || rolbypassrls FROM pg_roles WHERE rolname = current_user;
SELECT 'public tables without RLS: ' || count(*) FILTER (WHERE NOT c.relrowsecurity) || ' of ' || count(*)
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r';
SELECT 'app sees contacts: ' || count(*) FROM contacts;
SET ROLE anon;
SELECT 'anon sees contacts: ' || count(*) FROM contacts;
SELECT 'anon sees sales: ' || count(*) FROM sales;
RESET ROLE;
SQL
sed 's/^/   /' "$scratch/rls.out"
grep -qx "app role: superuser=false bypassrls=false" "$scratch/rls.out" \
  && grep -qE "^public tables without RLS: 0 of [1-9][0-9]*$" "$scratch/rls.out" \
  && grep -qx "anon sees contacts: 0" "$scratch/rls.out" && grep -qx "anon sees sales: 0" "$scratch/rls.out" \
  || { echo "FAIL: the app's role or the tables' row-level security is not what Supabase's would be" >&2; exit 1; }
for role in anon authenticated; do
  if psql "$pgurl" -X -q -At -c "SET ROLE $role; SELECT * FROM get_user_id_by_email('sam@leads.example')" > "$scratch/rls-auth.log" 2>&1; then
    echo "FAIL: $role read auth.users through get_user_id_by_email" >&2; exit 1
  fi
  if psql "$pgurl" -X -q -At -c "SET ROLE $role; SELECT count(*) FROM private.note_attachment_cleanups" > "$scratch/rls-queue.log" 2>&1; then
    echo "FAIL: $role read the attachments queue" >&2; exit 1
  fi
done
echo "   anon reads none of what was written; auth.users' emails and the attachments queue are closed to both API roles"

echo "e2e.test.sh: ok"
