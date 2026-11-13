/**
 * Postgres statement_timeout (SQLSTATE 57014) helpers for site-health soft-shells.
 * A 57014 must never 500 or hang a public page for the ~25s platform kill.
 */

export function isStatementTimeout(err: unknown): boolean {
  if (!err || typeof err !== "object") {
    return /statement timeout|canceling statement/i.test(String(err ?? ""));
  }
  const e = err as { code?: string; message?: string; details?: string; hint?: string };
  const code = e.code ?? "";
  const message = `${e.message ?? ""} ${e.details ?? ""} ${e.hint ?? ""}`;
  return code === "57014" || /statement timeout|canceling statement/i.test(message);
}

export function isDbFault(err: unknown): boolean {
  if (isStatementTimeout(err)) return true;
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string; name?: string };
  if (e.name === "AbortError" || e.name === "TimeoutError") return true;
  if (e.code === "ETIMEDOUT" || e.code === "ECONNRESET") return true;
  return /fetch failed|network|timeout/i.test(e.message ?? "");
}

/** One retry on 57014 — absorbs transient pooler contention without widening page size. */
export async function withTimeoutRetry<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!isStatementTimeout(err)) throw err;
    console.warn(`[db] ${label}: 57014 — retrying once`);
    return await fn();
  }
}
