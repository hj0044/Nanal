import sharp from "sharp";
import { createHash } from "node:crypto";

/**
 * Deterministic image QA: foreground geometry, transparent background, upper-body
 * visual fingerprint. These proxies CANNOT establish a fictional character's
 * facial identity, actual height, weight or bust size. Always request visual review.
 */
export async function describeAppearancePng(input,role){
  if(!["portrait","fullbody"].includes(role))throw Error("role must be portrait or fullbody");
  const expectedHeight=role==="portrait"?1024:1536;
  const source=sharp(input,{failOn:"error",limitInputPixels:2_000_000});
  const meta=await source.metadata();
  if(meta.format!=="png"||meta.width!==1024||meta.height!==expectedHeight||!meta.hasAlpha)
    throw Error("canonical_RGBA_PNG_required");
  // Sample a fixed, deterministic thumbnail. Sharp alpha is retained.
  const {data,info}=await source.clone().resize({width:128}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const w=info.width,h=info.height,mask=new Uint8Array(w*h);
  let minX=w,maxX=-1,minY=h,maxY=-1,foreground=0,opaque=0,clear=0,magenta=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=(y*w+x)*4,a=data[i+3],foregroundPixel=a>=128;
    if(a<=8)clear++;
    if(a>=250){
      opaque++;
      if(data[i]>=244&&data[i+1]<=14&&data[i+2]>=244)magenta++;
    }
    if(foregroundPixel){
      mask[y*w+x]=1;foreground++;
      minX=Math.min(minX,x);maxX=Math.max(maxX,x);
      minY=Math.min(minY,y);maxY=Math.max(maxY,y);
    }
  }
  if(!foreground||foreground/(w*h)<0.01)throw Error("foreground_missing");
  if(clear/(w*h)<0.005)throw Error("transparent_background_missing");
  if(opaque/(w*h)<0.01)throw Error("opaque_foreground_missing");
  if(magenta/(w*h)>0.003)throw Error("magenta_background_not_removed");
  const bw=maxX-minX+1,bh=maxY-minY+1;
  const profile=[];
  const n=24;
  for(let k=0;k<n;k++){
    const mid=minY+Math.min(bh-1,Math.floor(((k+0.5)/n)*bh));
    let first=w,last=-1;
    for(let x=0;x<w;x++)if(mask[mid*w+x]){first=Math.min(first,x);last=Math.max(last,x);}
    const width=last<0?0:(last-first+1)/bw;
    profile.push(Math.round(width*1000)/1000);
  }
  // Upper foreground region is only an image-texture proxy, NOT facial recognition.
  const fh=Math.max(8,Math.floor(bh*0.36));
  const faceCrop=await source.clone().extract({
    left:Math.max(0,minX*8),
    top:Math.max(0,minY*8),
    width:Math.min(1024-minX*8,Math.max(8,bw*8)),
    height:Math.min(expectedHeight-minY*8,Math.max(8,fh*8))
  }).flatten({background:"#ffffff"}).greyscale().resize(9,8,{fit:"fill"}).raw().toBuffer();
  let hash="";
  for(let y=0;y<8;y++)for(let x=0;x<8;x++)
    hash+=faceCrop[y*9+x]>faceCrop[y*9+x+1]?"1":"0";
  const sha256=createHash("sha256").update(input).digest("hex");
  return {
    role,sha256,width:meta.width,height:meta.height,
    coverage:Math.round(foreground/(w*h)*1000)/1000,
    transparentCoverage:Math.round(clear/(w*h)*1000)/1000,
    bbox:{x:minX/w,y:minY/h,width:bw/w,height:bh/h},
    silhouetteProfile:profile,upperImageDhash:hash,
    claim:"pixel_metrics_only_not_identity_recognition"
  };
}
function hamming(a,b){
  if(a.length!==b.length)throw Error("fingerprint_mismatch");
  let count=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])count++;
  return count/a.length;
}
export function evaluateVisualConsistency(reference,candidate,{appearanceId,lockedProfile}={}){
  if(!/^AP\d{3,5}$/.test(appearanceId??""))throw Error("canonical_AP_ID_required");
  if(!reference||!candidate||reference.role!==candidate.role||reference.sha256===undefined)
    throw Error("role_reference_required");
  if(!lockedProfile||!Number.isFinite(lockedProfile.heightCm)||
    !Number.isFinite(lockedProfile.weightKg))
    throw Error("locked_height_weight_profile_required");
  const imageDifference=hamming(reference.upperImageDhash,candidate.upperImageDhash);
  const rms=Math.sqrt(reference.silhouetteProfile.reduce((sum,v,i)=>
    sum+(v-candidate.silhouetteProfile[i])**2,0)/reference.silhouetteProfile.length);
  const canvasScale=Math.abs(reference.bbox.height-candidate.bbox.height);
  const repeat=reference.sha256===candidate.sha256;
  const flags=[];
  if(imageDifference>0.42)flags.push("upper_image_texture_differs");
  if(rms>0.23)flags.push("silhouette_width_profile_differs");
  if(canvasScale>0.12)flags.push("foreground_canvas_scale_differs");
  if(repeat)flags.push("exact_original_duplicate");
  return {
    schemaVersion:1,appearanceId,role:candidate.role,
    referenceSha256:reference.sha256,candidateSha256:candidate.sha256,
    lockedHeightCm:lockedProfile.heightCm,lockedWeightKg:lockedProfile.weightKg,
    evidence:{upperImageDhashDistance:+imageDifference.toFixed(4),
      silhouetteProfileRms:+rms.toFixed(4),foregroundScaleDelta:+canvasScale.toFixed(4)},
    flags,
    recommendedAction:flags.length?"manual_review_priority":"manual_review",
    approved:false,automatedIdentityConfirmed:false,
    limitations:[
      "2D silhouette cannot prove height/weight/bust, pose or outfit consistency",
      "Upper-image fingerprint is NOT a face embedding and cannot prove same-person identity",
      "Owner or trusted visual reviewer must compare both images and locked body profile"
    ]
  };
}
export async function compareAppearancePngs({referencePng,candidatePng,role,appearanceId,lockedProfile}){
  const [reference,candidate]=await Promise.all([
    describeAppearancePng(referencePng,role),describeAppearancePng(candidatePng,role)
  ]);
  return evaluateVisualConsistency(reference,candidate,{appearanceId,lockedProfile});
}
