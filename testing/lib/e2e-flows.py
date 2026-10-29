#!/usr/bin/env python3
"""What the CRM promises, driven against the built Worker under `wrangler dev`
(testing/e2e.test.sh, step 5): its HYPERDRIVE binding on the e2e's
Supabase-shaped Postgres, its Supabase the stand-in (fake-supabase.py).

    e2e-flows.py <url> <values.json> <admin-postgres-url> <keys-dir> <jwt.mjs> <supabase-url> <supabase-log>

Rows are written as Supabase would write them — auth.users as Supabase Auth
does on a sign-up, contacts as the app's Data API calls would — through the
admin URL; everything the Worker does is asked of the Worker.
"""
import html
import json
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid

base, values_path, admin, keys, jwt, sb_url, sblog = sys.argv[1:8]
name = json.load(open(values_path))["productname"]
problems = []


def bad(m):
    problems.append(m)


def req(path, data=None, headers=None, method=None):
    r = urllib.request.Request(base + path, data=data, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(r, timeout=60) as resp:
            return resp.status, {k.lower(): v for k, v in resp.headers.items()}, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, {k.lower(): v for k, v in e.headers.items()}, e.read().decode()


def sql(q):
    return subprocess.run(["psql", admin, "-XAtq", "-v", "ON_ERROR_STOP=1", "-c", q],
                          capture_output=True, text=True, check=True).stdout.strip()


def token(sub, email):
    return subprocess.run(["node", jwt, "sign", keys, sb_url + "/auth/v1", sub, email],
                          capture_output=True, text=True, check=True).stdout


def calls():
    return [json.loads(line) for line in open(sblog) if line.strip()]


def call(path, body, tok, method="POST"):
    h = {"content-type": "application/json", "apikey": "sb_publishable_e2e"}
    if tok:
        h["authorization"] = f"Bearer {tok}"
    return req(path, json.dumps(body).encode() if body is not None else None, h, method)


# ── the app, under the product's own name ─────────────────────────────────
s, _, page = req("/")
title = re.search(r"<title>(.*?)</title>", page, re.S)
if s != 200 or not title or html.unescape(title.group(1)) != name:
    bad(f"/ answered {s} with <title> {title and title.group(1)!r}, not {name!r}")
s, _, manifest = req("/manifest.json")
if s != 200 or json.loads(manifest).get("name") != name:
    bad(f"/manifest.json does not name the app {name!r}")
s, _, deep = req("/contacts/1/show")
if s != 200 or 'id="root"' not in deep:
    bad(f"a deep link answered {s}, not the app")

# ── the Worker's own routes ───────────────────────────────────────────────
s, _, body = req("/api/health")
if s != 200 or json.loads(body) != {"ok": True, "supabase": True, "database": True, "admin": True}:
    bad(f"/api/health answered {s} {body}")
s, _, _ = req("/functions/v1/no_such_function", b"{}", {"content-type": "application/json"}, "POST")
if s != 404:
    bad(f"an unknown function answered {s}, not 404")
s, h, _ = req("/functions/v1/users", None,
              {"origin": "https://elsewhere.example", "access-control-request-method": "POST"}, "OPTIONS")
if s != 204 or h.get("access-control-allow-origin") != "*":
    bad(f"CORS preflight answered {s}")
for path, method in (("/functions/v1/update_password", "PATCH"), ("/functions/v1/users", "POST"),
                     ("/functions/v1/merge_contacts", "POST"), ("/functions/v1/mcp", "POST")):
    s, _, _ = call(path, {}, None, method)
    if s != 401:
        bad(f"{method} {path} signed out answered {s}, not 401")
s, _, _ = req("/functions/v1/postmark", b"{}", {"content-type": "application/json"}, "POST")
if s != 503:
    bad(f"inbound email unconfigured answered {s}, not 503")

# ── the first account is the administrator ────────────────────────────────
uid, email = str(uuid.uuid4()), "sam@leads.example"
sql(f"insert into auth.users (id, email, raw_user_meta_data) values "
    f"('{uid}', '{email}', '{{\"first_name\":\"Sam\",\"last_name\":\"Lee\"}}')")
sale = sql(f"select administrator || ':' || first_name || ':' || id from public.sales where user_id = '{uid}'")
if not sale.startswith("true:Sam:"):
    bad(f"the first account's sales row is {sale!r}, not an administrator named Sam")
sale_id = sale.rsplit(":", 1)[-1]
tok = token(uid, email)

# ── a password reset, sent through the admin client ───────────────────────
s, _, body = call("/functions/v1/update_password", None, tok, "PATCH")
if s != 200:
    bad(f"update_password answered {s} {body[:120]}")
if not any(c["path"].startswith("/auth/v1/recover") and (c["body"] or {}).get("email") == email for c in calls()):
    bad("update_password did not ask Supabase Auth to send the reset email")

# ── two contacts merged, as the signed-in user, through Hyperdrive ────────
winner = sql(f"insert into contacts (first_name, last_name, sales_id, email_jsonb) values ('Ada', 'Lovelace', {sale_id}, "
             f"'[{{\"email\":\"ada@one.example\",\"type\":\"Work\"}}]') returning id")
loser = sql(f"insert into contacts (first_name, last_name, sales_id, email_jsonb) values ('Ada', null, {sale_id}, "
            f"'[{{\"email\":\"ada@two.example\",\"type\":\"Home\"}}]') returning id")
sql(f"insert into tasks (contact_id, type, text, due_date, sales_id) values ({loser}, 'Call', 'follow up', now(), {sale_id})")
s, _, body = call("/functions/v1/merge_contacts", {"loserId": int(loser), "winnerId": int(winner)}, tok)
if s != 200 or json.loads(body).get("success") is not True:
    bad(f"merge_contacts answered {s} {body[:160]}")
else:
    left = sql(f"select count(*) from contacts where id = {loser}")
    emails = sql(f"select string_agg(e->>'email', ',' order by e->>'email') from contacts, "
                 f"jsonb_array_elements(email_jsonb) e where id = {winner}")
    moved = sql(f"select count(*) from tasks where contact_id = {winner}")
    if left != "0" or emails != "ada@one.example,ada@two.example" or moved != "1":
        bad(f"the merge left the loser {left}, the winner's emails {emails!r}, its tasks {moved}")


# ── the MCP server, as that user ──────────────────────────────────────────
def mcp(payload):
    s, _, body = req("/functions/v1/mcp", json.dumps(payload).encode(),
                     {"authorization": f"Bearer {tok}", "content-type": "application/json",
                      "accept": "application/json, text/event-stream"}, "POST")
    data = [json.loads(line[5:]) for line in body.splitlines() if line.startswith("data:")]
    if not data and body.strip().startswith("{"):
        data = [json.loads(body)]
    return s, data


s, data = mcp({"jsonrpc": "2.0", "id": 1, "method": "initialize",
               "params": {"protocolVersion": "2025-06-18", "capabilities": {},
                          "clientInfo": {"name": "e2e", "version": "1"}}})
if s != 200 or not data or "result" not in data[0]:
    bad(f"MCP initialize answered {s} {data}")
for n in range(2):  # twice: the second request must get a database client of its own
    s, data = mcp({"jsonrpc": "2.0", "id": 2 + n, "method": "tools/call",
                   "params": {"name": "get_schema", "arguments": {}}})
    text = ""
    if data:
        content = (data[0].get("result") or {}).get("content") or [{}]
        text = content[0].get("text", "")
    if s != 200 or "Table: contacts" not in text or "Table: deals" not in text:
        bad(f"MCP get_schema (call {n + 1}) answered {s}: {str(data)[:200]}")

# ── a deleted note's attachments, queued, then removed by the Cron Trigger ─
note = sql(f"""insert into contact_notes (contact_id, text, sales_id, attachments)
  values ({winner}, 'with files', {sale_id},
          array['{{"src":"{sb_url}/storage/v1/object/public/attachments/e2e/a.png","path":"e2e/a.png"}}'::jsonb])
  returning id""")
sql(f"delete from contact_notes where id = {note}")
if sql("select count(*) from private.note_attachment_cleanups") != "1":
    bad("deleting a note queued nothing")
s, _, body = req("/cdn-cgi/handler/scheduled?cron=*/10+*+*+*+*")
if s != 200:
    bad(f"the Cron Trigger answered {s} {body[:80]}")
for _ in range(20):
    if sql("select count(*) from private.note_attachment_cleanups") == "0":
        break
    time.sleep(0.5)
removed = [c for c in calls() if c["method"] == "DELETE" and c["path"].startswith("/storage/v1/object/attachments")]
if sql("select count(*) from private.note_attachment_cleanups") != "0" or not removed \
        or (removed[-1]["body"] or {}).get("prefixes") != ["e2e/a.png"]:
    bad(f"the Cron Trigger did not remove the note's attachment: {removed}")

for p in problems:
    print(f"  ✕ {p}", file=sys.stderr)
if problems:
    sys.exit(1)
print("   the app under its own name; the health check; signed-out callers refused; the first account the")
print("   administrator; a reset email sent; two contacts merged as that user; the MCP server reading the")
print("   schema, twice; inbound email 503; a deleted note's attachment removed by the Cron Trigger")
