import { createHash } from "node:crypto";

const PNG_SIGNATURE=Buffer.from("89504e470d0a1a0a","hex");
const MAX_BYTES=16*1024*1024;
export function requireAppearanceId(id) {
  if(typeof id!=="string" || !/^AP\d{3,5}$/.test(id)) throw Error("Canonical AP identity required");
  return id;
}
function crc32(bytes) {
  let crc=0xffffffff;
  for(const byte of bytes) {
    crc^=byte;
    for(let i=0;i<8;i++) crc=(crc>>>1)^(crc&1?0xedb88320:0);
  }
  return (crc^0xffffffff)>>>0;
}
export function inspectPngBase64(value,{width,height}) {
  if(typeof value!=="string"||!value.length) throw Error("Missing PNG image bytes");
  const raw=value.startsWith("data:image/png;base64,")?value.slice(22):value;
  if(!/^[A-Za-z0-9+/]*={0,2}$/.test(raw)||raw.length%4!==0) throw Error("Invalid PNG base64");
  const bytes=Buffer.from(raw,"base64");
  if(bytes.length>MAX_BYTES||bytes.length<70) throw Error("PNG size outside supported range");
  if(!bytes.subarray(0,8).equals(PNG_SIGNATURE)) throw Error("Expected PNG signature");
  let cursor=8,seenIHDR=false,seenIDAT=false,seenIEND=false;
  while(cursor<bytes.length) {
    if(cursor+12>bytes.length) throw Error("Truncated PNG chunk");
    const size=bytes.readUInt32BE(cursor);
    if(size>MAX_BYTES||cursor+12+size>bytes.length) throw Error("Invalid PNG chunk length");
    const type=bytes.toString("ascii",cursor+4,cursor+8);
    const chunk=bytes.subarray(cursor+4,cursor+8+size);
    if(crc32(chunk)!==bytes.readUInt32BE(cursor+8+size)) throw Error("Invalid PNG CRC: "+type);
    if(!seenIHDR) {
      if(type!=="IHDR"||size!==13||cursor!==8) throw Error("Missing PNG IHDR");
      if(bytes.readUInt32BE(cursor+8)!==width||bytes.readUInt32BE(cursor+12)!==height) throw Error("Expected "+width+"x"+height+" PNG");
      if(bytes[cursor+16]!==8||bytes[cursor+17]!==6||bytes[cursor+18]!==0||bytes[cursor+19]!==0||bytes[cursor+20]!==0) throw Error("Expected 8-bit RGBA PNG");
      seenIHDR=true;
    }else if(type==="IHDR") throw Error("Repeated PNG header");
    if(type==="IDAT") seenIDAT=true;
    if(type==="IEND") {
      if(size!==0||cursor+12!==bytes.length) throw Error("Invalid PNG termination");
      seenIEND=true;
    }
    cursor+=size+12;
    if(seenIEND) break;
  }
  if(!seenIHDR||!seenIDAT||!seenIEND) throw Error("Incomplete PNG");
  return {sha256:createHash("sha256").update(bytes).digest("hex"),byteLength:bytes.length,base64:raw};
}
export function createInitialPairSubmission({appearanceId,portraitPng,fullBodyPng}) {
  requireAppearanceId(appearanceId);
  const portrait=inspectPngBase64(portraitPng,{width:1024,height:1024});
  const fullBody=inspectPngBase64(fullBodyPng,{width:1024,height:1536});
  return {appearanceId,portraitPng:portrait.base64,fullBodyPng:fullBody.base64,
    identityEvidence:{portraitSha256:portrait.sha256,fullBodySha256:fullBody.sha256}};
}
