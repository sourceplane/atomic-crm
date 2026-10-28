// What a production build inlines: the Supabase project the browser talks to,
// read from the `vars` of the wrangler.jsonc beside this file — committed as
// the fixture render of wrangler.template.jsonc, and re-rendered from the
// environment's wiring document by every Orun lane before it builds
// (component.yaml) — so the bundle and the Worker get the same URL and key
// from one place. A VITE_* value already in the environment (or .env.local)
// wins, as it does upstream.
import fs from "node:fs";

export function stripJsonc(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === "\\" ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j;
    } else if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
    } else if (c === "/" && text[i + 1] === "*") {
      i = text.indexOf("*/", i + 2);
      if (i < 0) break;
      i++;
    } else {
      out += c;
    }
  }
  return out.replace(/,(\s*[}\]])/g, "$1");
}

const FROM_WRANGLER = {
  VITE_SUPABASE_URL: "SUPABASE_URL",
  VITE_SB_PUBLISHABLE_KEY: "SB_PUBLISHABLE_KEY",
} as const;

export function supabaseBuildEnv(
  env: Record<string, string | undefined>,
  wranglerConfig: string,
): Record<string, string> {
  let vars: Record<string, unknown> = {};
  try {
    vars = JSON.parse(stripJsonc(fs.readFileSync(wranglerConfig, "utf8"))).vars ?? {};
  } catch {
    vars = {};
  }
  const out: Record<string, string> = {};
  for (const [key, from] of Object.entries(FROM_WRANGLER)) {
    const value = env[key] || vars[from];
    if (typeof value === "string" && value.length > 0) out[key] = value;
  }
  return out;
}
