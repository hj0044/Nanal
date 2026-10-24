// Pure policy layer for the standalone owner-operated image queue.
// No artificial daily image quota. Provider quotas, billing and QA still apply.
export const DAILY_JOB_LIMIT = null;
export const DEFAULT_IMAGE_MODEL = "gpt-image-2.5-flare";
export const RUNTIME_STATES = Object.freeze([
  "queued", "running", "retry_wait", "awaiting_review", "approved", "blocked", "provider_blocked"
]);
export function parseRetryAfter(value, now = Date.now()) {
  if (value == null || value === "") return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(86400000, Math.ceil(seconds * 1000));
  const date = Date.parse(String(value));
  return Number.isNaN(date) ? null : Math.min(86400000, Math.max(0, date-now));
}
export function classifyImageError({ status = 0, code = "", message = "", retryAfter = null }) {
  const reason = (String(code) + " " + String(message)).toLowerCase();
  const permanent = ["insufficient_quota","billing_hard_limit","billing_not_active","payment_required",
    "quota_exceeded","credit balance","insufficient credits","model access","organization verification"];
  if ([401,402,403].includes(status) || permanent.some(x=>reason.includes(x))
      || (status===429 && (reason.includes("permission") || reason.includes("not authorized"))))
    return {state:"provider_blocked",retryable:false,retryAfterMs:null};
  if (status===429) return {state:"rate_limited",retryable:true,retryAfterMs:parseRetryAfter(retryAfter)};
  if (status===0 || [408,409,425,500,502,503,504].includes(status))
    return {state:"temporary",retryable:true,retryAfterMs:parseRetryAfter(retryAfter)};
  return {state:"blocked",retryable:false,retryAfterMs:null};
}
export function retryDelayMs(attempt, afterMs=null, jitter=0.5) {
  const base = Math.min(3600000, 5000 * (2 ** Math.min(12, Math.max(0, attempt-1))));
  return Math.max(afterMs ?? 0, Math.round(base * (0.75 + 0.5*jitter)));
}
export function trustedReference(url, endpoint) {
  if (!endpoint) return false;
  try {
    const target=new URL(url), reference=new URL(endpoint);
    if (target.protocol!=="https:" || reference.protocol!=="https:" || target.origin!==reference.origin) return false;
    const prefix=reference.pathname.replace(/\/+$/, "");
    return target.pathname===prefix || target.pathname.startsWith(prefix + "/");
  } catch {return false;}
}
export function validateImageQueueRequest(job, endpoint) {
  if (!job || typeof job!=="object" || Array.isArray(job)) throw Error("Invalid job");
  if (!/^AP\d{3,5}$/.test(job.appearanceId)) throw Error("Invalid character ID");
  if (!["initial","variant"].includes(job.kind)) throw Error("Invalid generation kind");
  if (!["portrait","fullBody"].includes(job.slot)) throw Error("Invalid image slot");
  if (typeof job.prompt!=="string" || job.prompt.length<20 || job.prompt.length>32000) throw Error("Invalid locked prompt");
  if (!/^[a-f0-9]{64}$/i.test(job.profileSha256)) throw Error("Canonical profile hash required");
  if (typeof job.idempotencyKey!=="string" || !/^[a-z0-9:_\-.]{12,160}$/i.test(job.idempotencyKey)) throw Error("Idempotency key required");
  if (job.kind==="variant") {
    if (!trustedReference(job.referenceUrl,endpoint)) throw Error("Original approved reference URL required");
    if (!/^[a-f0-9]{64}$/i.test(job.referenceSha256)) throw Error("Original approved reference hash required");
  }
  return Object.freeze({...job});
}
