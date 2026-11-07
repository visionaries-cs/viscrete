/**
 * Turns raw errors ("Failed to fetch", "HTTP 401", backend `detail` strings)
 * into plain-language messages. The raw text is kept as `detail` so the UI can
 * show it under "Technical details" for debugging.
 */

export type ErrorKind =
  | "network" | "auth" | "forbidden" | "notfound" | "conflict"
  | "toolarge" | "unsupported" | "validation" | "server" | "unknown";

export interface FriendlyError {
  kind: ErrorKind;
  title: string;
  message: string;
  /** Raw error text for debugging; null when it adds nothing over `message`. */
  detail: string | null;
}

const NETWORK_RE = /failed to fetch|networkerror|network request failed|load failed|fetch failed|err_connection|err_network/i;

function rawText(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function statusOf(err: unknown, raw: string): number | null {
  const s = (err as { status?: unknown } | null)?.status;
  if (typeof s === "number") return s;
  const m = raw.match(/\bHTTP (\d{3})\b/);
  return m ? Number(m[1]) : null;
}

/** True when the raw text is only a status code, i.e. carries no useful wording. */
const isBareStatus = (raw: string) => /^HTTP \d{3}$/.test(raw.trim());

export function describeError(err: unknown, fallback = "Something went wrong."): FriendlyError {
  const raw = rawText(err).trim() || fallback;
  const status = statusOf(err, raw);
  // Backend `detail` strings ("Job 'x' not found.") are already readable — reuse them.
  const own = isBareStatus(raw) ? null : raw;

  const make = (kind: ErrorKind, title: string, message: string): FriendlyError => ({
    kind, title, message, detail: raw !== message ? raw : null,
  });

  if (NETWORK_RE.test(raw)) {
    return make("network", "Can't reach the server",
      "Check your internet connection, then try again. If you're online, the VISCRETE backend or its tunnel may be offline.");
  }
  if (status === 401 || /invalid or expired token|not authenticated/i.test(raw)) {
    return make("auth", "Your session has expired", "Please sign in again to continue.");
  }
  if (status === 403 || /access denied/i.test(raw)) {
    return make("forbidden", "You don't have access to this",
      "It belongs to another account, or your account can't open it.");
  }
  if (status === 404) {
    return make("notfound", "Not found", own ?? "It may have been deleted, or the link is wrong.");
  }
  if (status === 409) {
    return make("conflict", "Not ready yet", own ?? "This step can't run in the job's current state.");
  }
  if (status === 413) {
    return make("toolarge", "File too large", own ?? "One of the files is over the size limit.");
  }
  if (status === 415) {
    return make("unsupported", "Unsupported file type", own ?? "Use JPG, PNG, BMP or TIFF images.");
  }
  if (status === 422 || status === 400) {
    return make("validation", "Please check your input", own ?? "Some of the information is missing or invalid.");
  }
  if ((status !== null && status >= 500) || /internal server error|service unavailable/i.test(raw)) {
    return make("server", "Something went wrong on the server",
      "Try again. If it keeps happening, check the backend log.");
  }
  return make("unknown", "Something went wrong", own ?? fallback);
}

/** One-line friendly text for toasts, e.g. "Can't reach the VISCRETE server. The backend or its tunnel…". */
export function friendlyMessage(err: unknown, fallback?: string): string {
  const info = describeError(err, fallback);
  return `${info.title}. ${info.message}`;
}
