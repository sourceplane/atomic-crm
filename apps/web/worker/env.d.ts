// The Workers runtime module the env shim reads (worker/functions/_shared/deno.ts).
// The Worker is type-checked against the DOM's Fetch types — what Deno gives
// the edge functions upstream — rather than @cloudflare/workers-types, whose
// stricter Request (json(): unknown) upstream's code was never written for.
declare module "cloudflare:workers" {
  export const env: Record<string, unknown>;
}
