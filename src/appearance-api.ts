/** ChatGPT image upload API. No image model calls or Nanal application daily quota. */
export type AppearanceStoreEnv = {
  NANAL_APPEARANCE_DB?: { prepare(sql: string): { bind(...args: unknown[]): {
    first<T = Record<string, unknown>>(): Promise<T | null>;
    all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
    run(): Promise<unknown>;
  } } };
  NANAL_APPEARANCE_IMAGES?: {
    put(key: string, value: Uint8Array, options?: object): Promise<unknown>;
    get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
    delete(key: string): Promise<unknown>;
  };
  NANAL_APPEARANCE_ADMIN_TOKEN?: string;
};
type Row = Record<string, any>;
const MAX_BYTES = 16 * 1024 * 1024;
const sha = /^[a-f0-9]{64}$/i;
const apId = /^AP\d{3,5}$/;
const requestKeyPattern = /^[a-zA-Z0-9:_-]{12,160}$/;
const json = (body: object, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});
const err = (code: string, status = 400) => json({ error: code }, status);
const uint = (bytes: Uint8Array, offset: number) =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, false);

export function inspectAppearancePng(bytes: Uint8Array, slot: string): void {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength > MAX_BYTES || bytes.length < 70 ||
      ![137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v)) throw Error("png_invalid");
  const w = uint(bytes,16), h = uint(bytes,20);
  if (slot === "portrait" ? w !== 1024 || h !== 1024 : w !== 1024 || h !== 1536) throw Error("png_dimensions_invalid");
  if (uint(bytes,8) !== 13 || String.fromCharCode(...bytes.slice(12,16)) !== "IHDR" ||
      bytes[24] !== 8 || bytes[25] !== 6) throw Error("rgba_required");
  let i=8, idat=false, ended=false;
  while (i + 12 <= bytes.length) {
    const size=uint(bytes,i);
    if (size > MAX_BYTES || i + 12 + size > bytes.length) throw Error("png_truncated");
    const tag=String.fromCharCode(...bytes.slice(i+4,i+8));
    if (tag === "IDAT") idat=true;
    i += size + 12;
    if (tag === "IEND") { ended=i===bytes.length && size===0; break; }
  }
  if (!idat || !ended) throw Error("png_incomplete");
}
async function digest(bytes: Uint8Array): Promise<string> {
  const b = await crypto.subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(b)].map(v=>v.toString(16).padStart(2,"0")).join("");
}
async function authorized(req: Request, env: AppearanceStoreEnv): Promise<boolean> {
  const token=env.NANAL_APPEARANCE_ADMIN_TOKEN;
  if (!token || token.length < 32) return false;
  const header=req.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return false;
  const enc=new TextEncoder();
  return await digest(enc.encode(header.slice(7))) === await digest(enc.encode(token));
}
async function parseJson(req: Request): Promise<Row> {
  const data=await req.text();
  if (data.length>4096) throw Error("body_too_large");
  const value: unknown=JSON.parse(data);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("invalid_json");
  return value as Row;
}
const validIdentity = (p: Row): boolean =>
  apId.test(p.appearanceId) && ["남성","여성"].includes(p.gender) &&
  Number.isInteger(p.ageMin) && Number.isInteger(p.ageMax) && p.ageMin>=20 && p.ageMax<=59 &&
  p.ageMax>=p.ageMin && [p.profileSha256,p.portraitAnchorSha256,p.fullBodyAnchorSha256].every(x=>typeof x==="string"&&sha.test(x)) &&
  p.qaSource==="reviewed_official_reservation";

/** Serve only registered/approved images; all write routes require the owner token. */
export async function handleAppearanceApi(req: Request, env: AppearanceStoreEnv): Promise<Response | undefined> {
  const url=new URL(req.url), path=url.pathname;
  if (!path.startsWith("/api/appearance/")) return undefined;
  const db=env.NANAL_APPEARANCE_DB, storage=env.NANAL_APPEARANCE_IMAGES;
  if (!db || !storage) return err("asset_database_not_configured",503);
  try {
    if (path==="/api/appearance/catalog" && req.method==="GET") {
      const rows=await db.prepare("SELECT asset_id,appearance_id,gender,age_min,age_max,slot FROM appearance_variants WHERE status = 'approved' ORDER BY approved_at DESC LIMIT 500").bind().all<Row>();
      return json({assets:rows.results.map(r=>({
        assetId:r.asset_id,characterId:r.appearance_id,gender:r.gender,
        ageEstimate:{min:r.age_min,max:r.age_max},filename:r.asset_id+".png",
        imagePath:"/api/appearance/assets/"+r.asset_id,slot:r.slot,status:"approved",runtimeEligible:true
      }))});
    }
    const asset=path.match(/^\/api\/appearance\/assets\/([a-f0-9-]{36})$/);
    if (asset && ["GET","HEAD"].includes(req.method)) {
      const row=await db.prepare("SELECT storage_key FROM appearance_variants WHERE asset_id = ? AND status = 'approved'").bind(asset[1]).first<Row>();
      if (!row) return err("not_found",404);
      const img=await storage.get(row.storage_key);
      if (!img) return err("missing_asset",503);
      return new Response(req.method==="HEAD"?null:await img.arrayBuffer(),{
        headers:{"content-type":"image/png","x-content-type-options":"nosniff","cache-control":"public, max-age=300"}
      });
    }
    if (!await authorized(req,env)) return err("unauthorized",401);
    if (path==="/api/appearance/admin/status" && req.method==="GET")
      return json({ready:true,source:"chatgpt_upload_only",appDailyCap:null,remoteNanalPluginCap:"not_modified"});
    const origin=req.headers.get("origin");
    if (origin && new URL(origin).origin !== url.origin) return err("origin_not_allowed",403);
    const identity=path.match(/^\/api\/appearance\/identities\/(AP\d{3,5})$/);
    if (identity && req.method==="PUT") {
      const p=await parseJson(req);p.appearanceId=identity[1];
      if (!validIdentity(p)) return err("canonical_profile_invalid");
      const row=await db.prepare("SELECT * FROM appearance_identities WHERE appearance_id = ?").bind(p.appearanceId).first<Row>();
      if (row) {
        if (row.profile_sha256!==p.profileSha256 || row.portrait_anchor_sha256!==p.portraitAnchorSha256 ||
            row.full_body_anchor_sha256!==p.fullBodyAnchorSha256 || row.gender!==p.gender)
          return err("identity_locked",409);
        return json({appearanceId:p.appearanceId,status:"existing"});
      }
      await db.prepare("INSERT INTO appearance_identities(appearance_id,gender,age_min,age_max,profile_sha256,portrait_anchor_sha256,full_body_anchor_sha256,source) VALUES(?,?,?,?,?,?,?,?)")
        .bind(p.appearanceId,p.gender,p.ageMin,p.ageMax,p.profileSha256,p.portraitAnchorSha256,p.fullBodyAnchorSha256,p.qaSource).run();
      return json({appearanceId:p.appearanceId,status:"registered"},201);
    }
    const variants=path.match(/^\/api\/appearance\/identities\/(AP\d{3,5})\/variants$/);
    if (variants && req.method==="POST") {
      const profile=await db.prepare("SELECT * FROM appearance_identities WHERE appearance_id = ?").bind(variants[1]).first<Row>();
      if (!profile) return err("canonical_identity_missing",409);
      if (Number(req.headers.get("content-length")||0)>2*MAX_BYTES) return err("body_too_large",413);
      const form=await req.formData();
      const slot=form.get("slot"),profileHash=form.get("profileSha256"),anchorHash=form.get("anchorSha256"),key=form.get("requestKey"),file=form.get("image");
      if (!["portrait","fullBody"].includes(String(slot)) || !sha.test(String(profileHash)) ||
          !sha.test(String(anchorHash)) || !requestKeyPattern.test(String(key))) return err("metadata_invalid");
      if (profileHash!==profile.profile_sha256 || anchorHash!==(slot==="portrait"?profile.portrait_anchor_sha256:profile.full_body_anchor_sha256))
        return err("identity_anchor_mismatch",409);
      if (!(file instanceof File) || file.size>MAX_BYTES || file.size<70) return err("image_invalid",413);
      const bytes=new Uint8Array(await file.arrayBuffer());
      inspectAppearancePng(bytes,String(slot));
      const checksum=await digest(bytes);
      const existing=await db.prepare("SELECT asset_id,appearance_id,slot,file_sha256,status FROM appearance_variants WHERE request_key = ?").bind(key).first<Row>();
      if (existing) return existing.appearance_id===variants[1]&&existing.slot===slot&&existing.file_sha256===checksum
        ? json({assetId:existing.asset_id,status:existing.status,duplicate:true})
        : err("idempotency_conflict",409);
      const assetId=crypto.randomUUID(),storageKey="nanal/pending/"+assetId+".png";
      await storage.put(storageKey,bytes,{httpMetadata:{contentType:"image/png"}});
      try {
        await db.prepare("INSERT INTO appearance_variants(asset_id,request_key,appearance_id,gender,age_min,age_max,slot,profile_sha256,anchor_sha256,file_sha256,storage_key,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")
          .bind(assetId,key,variants[1],profile.gender,profile.age_min,profile.age_max,slot,profileHash,anchorHash,checksum,storageKey,"awaiting_review").run();
      } catch(e) { await storage.delete(storageKey); throw e; }
      return json({assetId,status:"awaiting_review",fileSha256:checksum},201);
    }
    const review=path.match(/^\/api\/appearance\/variants\/([a-f0-9-]{36})\/review$/);
    if (review && req.method==="POST") {
      const p=await parseJson(req),qa=p.qa;
      if (!qa || typeof qa!=="object" || !["approved","blocked"].includes(p.decision) ||
          typeof p.notes!=="string" || p.notes.length<30 || p.notes.length>2000)
        return err("review_invalid");
      const row=await db.prepare("SELECT * FROM appearance_variants WHERE asset_id = ?").bind(review[1]).first<Row>();
      if (!row) return err("not_found",404);
      if (row.status!=="awaiting_review") return err("already_reviewed",409);
      const passes=["face","body","heightScale","chestSilhouette","transparentBackground","matchesCanonicalAnchor"].every(k=>qa[k]===true);
      if (p.decision==="approved" && !passes) return err("qa_evidence_missing",409);
      await db.prepare("UPDATE appearance_variants SET status = ?,review_note = ?,approved_at = ? WHERE asset_id = ? AND status = 'awaiting_review'")
        .bind(p.decision,p.notes,p.decision==="approved"?new Date().toISOString():null,review[1]).run();
      return json({assetId:review[1],status:p.decision});
    }
    return err("not_found",404);
  } catch(e) {
    const message=e instanceof Error?e.message:"server_error";
    if (["png_invalid","png_dimensions_invalid","rgba_required","png_truncated","png_incomplete","invalid_json","body_too_large"].includes(message))
      return err(message,400);
    return err("server_error",500);
  }
}
