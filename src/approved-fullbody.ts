/**
 * Public-facing APPROVED full-body artwork only. This cache never stores
 * pending/blocked assets or arbitrary CDN URLs. It is populated from the
 * same-origin /api/appearance/catalog API and belongs to the current game run.
 */
export type FullBodyArtwork = {
  assetId: string;
  characterId: string;
  imagePath: string;
  slot: "fullBody";
};
const byAsset=new Map<string,FullBodyArtwork>();
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ap=/^AP[0-9]{3,5}$/;
export function importApprovedFullBodies(payload:unknown):number {
  if(!payload || typeof payload!=="object" || !("assets" in payload)) return 0;
  const assets=(payload as {assets?:unknown}).assets;
  if(!Array.isArray(assets))return 0;
  let added=0;
  for(const entry of assets){
    if(!entry||typeof entry!=="object")continue;
    const row=entry as Record<string,unknown>;
    if(row.slot!=="fullBody"||row.status!=="approved"||row.runtimeEligible!==true||
       typeof row.assetId!=="string"||!uuid.test(row.assetId)||
       typeof row.characterId!=="string"||!ap.test(row.characterId)||
       row.imagePath!=="/api/appearance/assets/"+row.assetId)continue;
    if(!byAsset.has(row.assetId))added++;
    byAsset.set(row.assetId,{
      assetId:row.assetId,characterId:row.characterId,
      slot:"fullBody",imagePath:row.imagePath
    });
  }
  return added;
}
export function approvedFullBodiesForIdentity(identityId:string|undefined):FullBodyArtwork[] {
  if(!identityId||!ap.test(identityId))return [];
  return [...byAsset.values()].filter(row=>row.characterId===identityId)
    .sort((a,b)=>a.assetId.localeCompare(b.assetId));
}
/** Test-only cache cleanup does not change server approval or original asset data. */
export function clearApprovedFullBodyCacheForTest():void {byAsset.clear();}
