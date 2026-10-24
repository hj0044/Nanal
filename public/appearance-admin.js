"use strict";
let token="",identities=[],active=null,objectUrls=[];
const $=id=>document.getElementById(id);
function show(message){$("status").textContent=message}
function assertReady(){if(!token)throw Error("먼저 관리자 인증을 완료하세요.")}
async function api(path,options={}){
 assertReady();
 const headers=new Headers(options.headers||{});
 headers.set("Authorization","Bearer "+token);
 const response=await fetch(path,{...options,headers,credentials:"same-origin",redirect:"error",cache:"no-store"});
 if(!response.ok){
   let code="HTTP "+response.status;
   try{const error=await response.json();code=error.error??code}catch{}
   throw Error(code);
 }
 const type=response.headers.get("content-type")??"";
 return type.includes("application/json")?response.json():response.blob();
}
function verifyId(id){if(!/^AP[0-9]{3,5}$/.test(id))throw Error("AP 캐릭터 정본 ID가 올바르지 않습니다.")}
async function sha(file){
 const bytes=await crypto.subtle.digest("SHA-256",await file.arrayBuffer());
 return Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,"0")).join("");
}
async function refresh(){
 const [data,queue]=await Promise.all([
   api("/api/appearance/admin/identities"),api("/api/appearance/admin/queue")
 ]);
 identities=data.identities??[];
 const selector=$("candidate-id");selector.replaceChildren();
 for(const item of identities){
   const option=document.createElement("option");
   option.value=item.appearanceId;option.textContent=item.appearanceId+" · "+item.gender;
   selector.appendChild(option);
 }
 renderQueue(queue.assets??[]);
 show("연결 완료 · 정본 "+identities.length+"명 · 검수 대기 "+(queue.assets??[]).length+"건");
}
function clearImages(){
 for(const url of objectUrls)URL.revokeObjectURL(url);
 objectUrls=[];$("review-area").classList.add("hidden");active=null;
}
function renderQueue(assets){
 clearImages();const container=$("queue-items");container.replaceChildren();
 if(!assets.length){const p=document.createElement("p");p.textContent="검수 대기 이미지가 없습니다.";container.appendChild(p)}
 for(const entry of assets){
   const item=document.createElement("article");item.className="item";
   const h=document.createElement("div");h.className="headline";
   const id=document.createElement("strong");id.textContent=entry.appearanceId+" · "+(entry.slot==="portrait"?"얼굴":"전신");
   const btn=document.createElement("button");btn.type="button";btn.className="secondary";
   btn.textContent="기준 원본과 비교";
   btn.addEventListener("click",()=>compare(entry).catch(error=>show("이미지 열기 실패: "+error.message)));
   h.append(id,btn);
   const extra=document.createElement("small");
   extra.textContent="자산 ID "+entry.assetId+" · SHA-256 "+entry.fileSha256;
   item.append(h,extra);container.appendChild(item);
 }
}
async function compare(entry){
 clearImages();
 const role=entry.slot;
 const [reference,candidate]=await Promise.all([
   api("/api/appearance/admin/references/"+entry.appearanceId+"/"+role),
   api("/api/appearance/admin/assets/"+entry.assetId)
 ]);
 const refUrl=URL.createObjectURL(reference),candidateUrl=URL.createObjectURL(candidate);
 objectUrls.push(refUrl,candidateUrl);
 $("reference-img").src=refUrl;$("candidate-img").src=candidateUrl;
 $("review-title").textContent=entry.appearanceId+" · "+(role==="portrait"?"얼굴":"전신")+" 후보 비교";
 $("review-area").classList.remove("hidden");
 $("review-form").reset();active=entry;
 $("review-area").scrollIntoView({block:"nearest",behavior:"smooth"});
}
$("auth-form").addEventListener("submit",async event=>{
 event.preventDefault();token=$("token").value.trim();
 if(token.length<32){show("관리자 토큰은 32자 이상이어야 합니다.");return}
 try{const s=await api("/api/appearance/admin/status");if(!s.ready)throw Error("이미지 서버 준비되지 않음");
    await refresh();$("token").value="";}catch(e){token="";show("연결 실패: "+e.message)}
});
$("refresh").addEventListener("click",()=>refresh().catch(e=>show("목록 갱신 실패: "+e.message)));
$("bootstrap-form").addEventListener("submit",async event=>{
 event.preventDefault();
 try{
   assertReady();
   const form=new FormData(event.currentTarget),id=String(form.get("appearanceId")??"").trim();
   verifyId(id);form.delete("appearanceId");form.set("reservationId","reserve:"+id);
   form.set("ownerConfirmed","true");
   const result=await api("/api/appearance/identities/"+id+"/bootstrap",{method:"POST",body:form});
   show(id+" 정본 "+result.status+" · 기준 원본 보존: "+result.originalsStored);
   await refresh();
 }catch(e){show("정본 등록 실패: "+e.message)}
});
$("candidate-form").addEventListener("submit",async event=>{
 event.preventDefault();
 try{
   assertReady();
   const form=new FormData(event.currentTarget),id=String(form.get("appearanceId")),
      slot=String(form.get("slot")),image=form.get("image");
   verifyId(id);
   const identity=identities.find(x=>x.appearanceId===id);
   if(!identity)throw Error("잠긴 정본이 등록되지 않았습니다.");
   if(!(image instanceof File)||image.size>16*1024*1024)throw Error("16MB 이하 PNG 파일이 필요합니다.");
   const digest=await sha(image);
   form.set("profileSha256",identity.profileSha256);
   form.set("anchorSha256",slot==="portrait"?identity.portraitAnchorSha256:identity.fullBodyAnchorSha256);
   form.set("requestKey",id+":"+slot+":"+digest);
   form.delete("appearanceId");
   const result=await api("/api/appearance/identities/"+id+"/variants",{method:"POST",body:form});
   show(id+" 후보 접수: "+result.status+" · "+result.assetId);
   await refresh();
 }catch(e){show("추가 이미지 제출 실패: "+e.message)}
});
$("review-form").addEventListener("submit",async event=>{
 event.preventDefault();
 try{
   assertReady();if(!active)throw Error("검수 후보를 선택해야 합니다.");
   const form=new FormData(event.currentTarget);
   const submitter=event.submitter;
   const decision=submitter?.value;
   const keys=["face","body","heightScale","chestSilhouette","transparentBackground","matchesCanonicalAnchor"];
   const qa=Object.fromEntries(keys.map(key=>[key,form.get(key)==="on"]));
   if(decision==="approved"&&!keys.every(key=>qa[key]===true))
     throw Error("승인하려면 6가지 항목 모두 직접 확인해야 합니다.");
   const notes=String(form.get("notes")??"").trim();
   if(notes.length<30)throw Error("검수 근거를 30자 이상 작성해 주세요.");
   const result=await api("/api/appearance/variants/"+active.assetId+"/review",{
     method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({decision,notes,qa})
   });
   show(active.appearanceId+" 후보 "+result.status+" · "+result.assetId);
   await refresh();
 }catch(e){show("검수 저장 실패: "+e.message)}
});
window.addEventListener("pagehide",clearImages);
