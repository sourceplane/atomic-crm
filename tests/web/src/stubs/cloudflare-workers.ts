// `cloudflare:workers` under Node: the Worker's env is the test process's
// environment (vitest.config.ts sets what the functions read), so a suite can
// change a value with vi.stubEnv before it imports a function.
export const env = process.env as unknown as Record<string, unknown>;
