import type { PluginAPI } from "@voltius/plugin-types";

type Http = PluginAPI["http"];

const CF_API = "https://api.cloudflare.com/client/v4";

/** Prefer latest release asset; fall back to a pinned tag if latest 404s. */
export const WORKER_ARTIFACT_URLS = [
  "https://github.com/mrchatam/voltius-cloudflare-sync-worker/releases/latest/download/worker.mjs",
  "https://github.com/mrchatam/voltius-cloudflare-sync-worker/releases/download/v0.2.0/worker.mjs",
] as const;

export const DEPLOY_TO_CLOUDFLARE_URL =
  "https://deploy.workers.cloudflare.com/?url=https://github.com/mrchatam/voltius-cloudflare-sync-worker";

export const DEFAULT_WORKER_NAME = "voltius-cloudflare-sync";
export const DEFAULT_BUCKET_NAME = "voltius-vault-sync";
export const WORKER_COMPATIBILITY_DATE = "2025-09-06";
export const WORKER_COMPATIBILITY_FLAGS = ["nodejs_compat"] as const;
export const WORKER_MODULE_NAME = "worker.mjs";

export class CloudflareDeployError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "CloudflareDeployError";
  }
}

export type DeployWorkerInput = {
  accountId: string;
  apiToken: string;
  workerName: string;
  bucketName: string;
  syncToken: string;
};

export type DeployWorkerResult = {
  workerUrl: string;
  subdomain: string | null;
};

type CfEnvelope<T> = {
  success: boolean;
  errors?: Array<{ code?: number; message?: string }>;
  result?: T;
};

function authHeaders(apiToken: string, extra?: Record<string, string>): HeadersInit {
  return {
    Authorization: `Bearer ${apiToken}`,
    Accept: "application/json",
    ...extra,
  };
}

function formatCfErrors(payload: CfEnvelope<unknown> | null, fallback: string): string {
  const msgs = payload?.errors?.map((e) => e.message).filter(Boolean) ?? [];
  if (msgs.length) return msgs.join("; ");
  return fallback;
}

async function readCfJson<T>(res: Response, context: string): Promise<T> {
  const text = await res.text().catch(() => "");
  let payload: CfEnvelope<T> | null = null;
  try {
    payload = text ? (JSON.parse(text) as CfEnvelope<T>) : null;
  } catch {
    /* keep null */
  }

  if (res.status === 401 || res.status === 403) {
    throw new CloudflareDeployError(
      res.status,
      `${context}: Cloudflare rejected the API token (${res.status}). Check Workers Scripts Edit, Workers R2 Storage Edit, and Account Settings Read.`,
    );
  }

  if (!res.ok || payload?.success === false) {
    const detail = formatCfErrors(payload, text || res.statusText);
    throw new CloudflareDeployError(res.status, `${context}: ${detail}`);
  }

  return (payload?.result ?? (null as unknown as T)) as T;
}

/** High-entropy sync token suitable for Worker SYNC_TOKEN. */
export function generateSyncToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  // base64url without padding
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function fetchWorkerArtifact(http: Http): Promise<string> {
  let lastErr: Error | null = null;
  for (const url of WORKER_ARTIFACT_URLS) {
    try {
      const res = await http.stream(url, { method: "GET" });
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status} fetching ${url}`);
        continue;
      }
      const text = await res.text();
      if (!text.includes("export") || text.length < 100) {
        lastErr = new Error(`Artifact from ${url} looks empty or invalid`);
        continue;
      }
      return text;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw new CloudflareDeployError(
    0,
    `Could not download Worker artifact. ${lastErr?.message ?? "Unknown error"}`,
  );
}

/** Create R2 bucket; ignore already-exists (HTTP 409 / CF code 10004-ish). */
export async function ensureR2Bucket(
  http: Http,
  accountId: string,
  apiToken: string,
  bucketName: string,
): Promise<void> {
  const res = await http.stream(`${CF_API}/accounts/${encodeURIComponent(accountId)}/r2/buckets`, {
    method: "POST",
    headers: authHeaders(apiToken, { "Content-Type": "application/json" }),
    body: JSON.stringify({ name: bucketName }),
  });

  if (res.status === 409) return;

  const text = await res.text().catch(() => "");
  let payload: CfEnvelope<unknown> | null = null;
  try {
    payload = text ? (JSON.parse(text) as CfEnvelope<unknown>) : null;
  } catch {
    /* ignore */
  }

  // Cloudflare sometimes returns 400 with "already exists" / code 10004
  const joined = formatCfErrors(payload, text).toLowerCase();
  if (
    res.status === 400 &&
    (joined.includes("already exists") ||
      joined.includes("bucket already") ||
      payload?.errors?.some((e) => e.code === 10004 || e.code === 10007))
  ) {
    return;
  }

  if (res.status === 401 || res.status === 403) {
    throw new CloudflareDeployError(
      res.status,
      `ensureR2Bucket: Cloudflare rejected the API token (${res.status}). Need Workers R2 Storage Edit.`,
    );
  }

  if (!res.ok || payload?.success === false) {
    throw new CloudflareDeployError(
      res.status,
      `ensureR2Bucket: ${formatCfErrors(payload, text || res.statusText)}`,
    );
  }
}

async function uploadWorkerScript(
  http: Http,
  accountId: string,
  apiToken: string,
  workerName: string,
  bucketName: string,
  script: string,
  syncToken: string,
): Promise<void> {
  const metadata = {
    main_module: WORKER_MODULE_NAME,
    compatibility_date: WORKER_COMPATIBILITY_DATE,
    compatibility_flags: [...WORKER_COMPATIBILITY_FLAGS],
    bindings: [
      {
        type: "r2_bucket",
        name: "VAULT_BUCKET",
        bucket_name: bucketName,
      },
      {
        type: "secret_text",
        name: "SYNC_TOKEN",
        text: syncToken,
      },
    ],
  };

  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" }),
  );
  form.append(
    WORKER_MODULE_NAME,
    new Blob([script], { type: "application/javascript+module" }),
    WORKER_MODULE_NAME,
  );

  const res = await http.stream(
    `${CF_API}/accounts/${encodeURIComponent(accountId)}/workers/scripts/${encodeURIComponent(workerName)}`,
    {
      method: "PUT",
      headers: authHeaders(apiToken),
      body: form,
    },
  );
  await readCfJson(res, "uploadWorkerScript");
}

/** Put / update SYNC_TOKEN secret (idempotent). */
export async function putWorkerSecret(
  http: Http,
  accountId: string,
  apiToken: string,
  workerName: string,
  name: string,
  text: string,
): Promise<void> {
  const res = await http.stream(
    `${CF_API}/accounts/${encodeURIComponent(accountId)}/workers/scripts/${encodeURIComponent(workerName)}/secrets`,
    {
      method: "PUT",
      headers: authHeaders(apiToken, { "Content-Type": "application/json" }),
      body: JSON.stringify({ name, text, type: "secret_text" }),
    },
  );
  await readCfJson(res, "putWorkerSecret");
}

export async function getWorkersSubdomain(
  http: Http,
  accountId: string,
  apiToken: string,
): Promise<string | null> {
  const res = await http.stream(
    `${CF_API}/accounts/${encodeURIComponent(accountId)}/workers/subdomain`,
    {
      method: "GET",
      headers: authHeaders(apiToken),
    },
  );
  if (res.status === 404) return null;
  const result = await readCfJson<{ subdomain?: string }>(res, "getWorkersSubdomain");
  const sub = result?.subdomain?.trim();
  return sub || null;
}

export async function enableWorkersDev(
  http: Http,
  accountId: string,
  apiToken: string,
  workerName: string,
): Promise<void> {
  const res = await http.stream(
    `${CF_API}/accounts/${encodeURIComponent(accountId)}/workers/scripts/${encodeURIComponent(workerName)}/subdomain`,
    {
      method: "POST",
      headers: authHeaders(apiToken, { "Content-Type": "application/json" }),
      body: JSON.stringify({ enabled: true }),
    },
  );
  // Some accounts already have it enabled; treat success / noop.
  if (res.status === 404) return;
  await readCfJson(res, "enableWorkersDev");
}

/**
 * Full deploy: ensure R2 → fetch artifact → upload Worker (+ SYNC_TOKEN) →
 * enable workers.dev → resolve URL.
 */
export async function deployWorker(
  http: Http,
  input: DeployWorkerInput,
): Promise<DeployWorkerResult> {
  const accountId = input.accountId.trim();
  const apiToken = input.apiToken.trim();
  const workerName = (input.workerName.trim() || DEFAULT_WORKER_NAME).replace(/[^a-zA-Z0-9_-]/g, "-");
  const bucketName = (input.bucketName.trim() || DEFAULT_BUCKET_NAME).replace(/[^a-zA-Z0-9_-]/g, "-");
  const syncToken = input.syncToken.trim();

  if (!accountId) throw new CloudflareDeployError(0, "Cloudflare Account ID is required");
  if (!apiToken) throw new CloudflareDeployError(0, "Cloudflare API token is required");
  if (!syncToken) throw new CloudflareDeployError(0, "Sync token is required before deploy");

  await ensureR2Bucket(http, accountId, apiToken, bucketName);
  const script = await fetchWorkerArtifact(http);
  await uploadWorkerScript(http, accountId, apiToken, workerName, bucketName, script, syncToken);
  // Secrets API as belt-and-suspenders (upload also sets secret_text binding).
  await putWorkerSecret(http, accountId, apiToken, workerName, "SYNC_TOKEN", syncToken);

  try {
    await enableWorkersDev(http, accountId, apiToken, workerName);
  } catch {
    // Non-fatal: script + secret already uploaded; URL resolve / manual paste still work.
  }

  const subdomain = await getWorkersSubdomain(http, accountId, apiToken);
  if (subdomain) {
    return {
      workerUrl: `https://${workerName}.${subdomain}.workers.dev`,
      subdomain,
    };
  }

  // Subdomain API unavailable (often missing Account Settings Read). Caller should prompt
  // the user to paste the workers.dev URL from the Cloudflare dashboard.
  return {
    workerUrl: "",
    subdomain: null,
  };
}
