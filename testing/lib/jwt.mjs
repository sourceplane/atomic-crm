#!/usr/bin/env node
// Supabase Auth's signing, stood in for with node:crypto alone (no
// dependency): an RS256 key pair whose public half is the JWKS the stand-in
// serves at /auth/v1/.well-known/jwks.json, and access tokens shaped as
// Supabase Auth issues them — what the Worker's functions verify.
//
//   node jwt.mjs keys <dir>                       write <dir>/key.pem and <dir>/jwks.json
//   node jwt.mjs sign <dir> <iss> <sub> <email>   print a token for that user
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const [cmd, dir, ...rest] = process.argv.slice(2);
const b64 = (buf) => Buffer.from(buf).toString("base64url");

if (cmd === "keys") {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  fs.writeFileSync(path.join(dir, "key.pem"), privateKey.export({ type: "pkcs8", format: "pem" }));
  const jwk = publicKey.export({ format: "jwk" });
  fs.writeFileSync(path.join(dir, "jwks.json"), JSON.stringify({ keys: [{ ...jwk, kid: "e2e", alg: "RS256", use: "sig" }] }));
} else if (cmd === "sign") {
  const [iss, sub, email] = rest;
  const now = Math.floor(Date.now() / 1000);
  const header = b64(JSON.stringify({ alg: "RS256", kid: "e2e", typ: "JWT" }));
  const payload = b64(JSON.stringify({
    iss, sub, email, aud: "authenticated", role: "authenticated", iat: now, exp: now + 3600,
  }));
  const key = crypto.createPrivateKey(fs.readFileSync(path.join(dir, "key.pem")));
  const sig = crypto.sign("RSA-SHA256", Buffer.from(`${header}.${payload}`), key);
  process.stdout.write(`${header}.${payload}.${b64(sig)}`);
} else {
  console.error("usage: jwt.mjs keys <dir> | sign <dir> <iss> <sub> <email>");
  process.exit(2);
}
