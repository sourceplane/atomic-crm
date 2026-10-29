#!/usr/bin/env python3
"""A stand-in for the Supabase project the CRM's Worker calls at run time —
the slice of Auth and Storage its edge functions use — so the e2e can drive
them against a real Postgres.

    fake-supabase.py <port> <jwks.json> <log.jsonl>

  GET    /auth/v1/.well-known/jwks.json   the signing keys (testing/lib/jwt.mjs)
  GET    /auth/v1/user                    the user a bearer token names (its claims)
  POST   /auth/v1/recover                 a password-reset email, recorded
  DELETE /storage/v1/object/<bucket>      files removed (storage-js's remove), recorded

Every call is appended to the log as one JSON line ({method, path, body}),
which the e2e reads to see what the Worker asked for. The service-role key's
presence is checked on the admin calls; the token's signature is the
Worker's to verify, not this stand-in's.
"""
import base64
import http.server
import json
import sys

PORT, JWKS, LOG = int(sys.argv[1]), open(sys.argv[2]).read(), sys.argv[3]


def claims(auth: str):
    try:
        payload = auth.split(" ", 1)[1].split(".")[1]
        return json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
    except Exception:
        return None


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def answer(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def record(self):
        n = int(self.headers.get("content-length") or 0)
        raw = self.rfile.read(n).decode() if n else ""
        try:
            body = json.loads(raw) if raw else None
        except ValueError:
            body = raw
        with open(LOG, "a") as f:
            f.write(json.dumps({"method": self.command, "path": self.path, "body": body,
                                "apikey": bool(self.headers.get("apikey"))}) + "\n")
        return body

    def do_GET(self):
        if self.path.startswith("/auth/v1/.well-known/jwks.json"):
            data = JWKS.encode()
            self.send_response(200)
            self.send_header("content-type", "application/json")
            self.send_header("content-length", str(len(data)))
            self.end_headers()
            return self.wfile.write(data)
        if self.path.startswith("/auth/v1/user"):
            self.record()
            c = claims(self.headers.get("authorization") or "")
            if not c or not c.get("sub"):
                return self.answer(401, {"msg": "invalid JWT"})
            return self.answer(200, {"id": c["sub"], "email": c.get("email"), "aud": "authenticated",
                                     "role": "authenticated", "app_metadata": {}, "user_metadata": {}})
        return self.answer(404, {"msg": f"no {self.path} here"})

    def do_POST(self):
        self.record()
        if self.path.startswith("/auth/v1/recover"):
            return self.answer(200, {})
        return self.answer(404, {"msg": f"no {self.path} here"})

    def do_DELETE(self):
        body = self.record()
        if self.path.startswith("/storage/v1/object/"):
            names = (body or {}).get("prefixes") or []
            return self.answer(200, [{"name": n} for n in names])
        return self.answer(404, {"msg": f"no {self.path} here"})


http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
