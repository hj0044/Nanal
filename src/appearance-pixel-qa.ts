/**
 * Runtime-compatible pixel QA (Cloudflare Worker/Node). Uses the PNG's own IDAT
 * zlib stream and the browser/Worker DecompressionStream; no ImageMagick or
 * external image model. This is NOT a same-person, anatomy or face verifier.
 */
export type PixelQaResult = {
  technicalPassed: true;
  width: number;
  height: number;
  transparentFraction: number;
  foregroundFraction: number;
  bbox: { left: number; top: number; right: number; bottom: number };
  qaVersion: 1;
  identityVerified: false;
};
const readUint=(v:Uint8Array,i:number)=>new DataView(v.buffer,v.byteOffset,v.byteLength).getUint32(i);
const tag=(v:Uint8Array,i:number)=>String.fromCharCode(...v.subarray(i,i+4));
const reject=(code:string):never=>{throw new Error("image_pixel_qa_"+code);};
export async function checkTransparentCharacterPng(bytes: Uint8Array, slot:"portrait"|"fullBody"):Promise<PixelQaResult> {
  if (!(bytes instanceof Uint8Array)||bytes.length<70||tag(bytes,12)!=="IHDR")return reject("invalid_png");
  const width=readUint(bytes,16),height=readUint(bytes,20);
  if(width!==1024||height!==(slot==="portrait"?1024:1536) || bytes[24]!==8 || bytes[25]!==6 ||
     bytes[26]!==0 || bytes[27]!==0 || bytes[28]!==0)
    return reject("format");
  // Image structure/CRC is validated separately by inspectAppearancePng.
  // Reject interlacing and unsupported ancillary behavior explicitly.
  const stride=width*4,expected=height*(stride+1);
  const compressed:Uint8Array[]=[];
  let i=8,bytesCompressed=0;
  while(i<bytes.length){
    if(i+12>bytes.length)return reject("chunk");
    const length=readUint(bytes,i),kind=tag(bytes,i+4);
    if(i+12+length>bytes.length)return reject("chunk");
    if(kind==="IDAT"){
      const part=bytes.slice(i+8,i+8+length);
      compressed.push(part);bytesCompressed+=length;
    }
    i+=12+length;
    if(kind==="IEND")break;
  }
  if(!compressed.length||bytesCompressed===0)return reject("idat");
  const packed=new Uint8Array(bytesCompressed);let p=0;
  for(const part of compressed){packed.set(part,p);p+=part.length;}
  let decoded:Uint8Array;
  try{
    const stream=new Blob([packed as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate"));
    const chunks:Uint8Array[]=[];let total=0;
    const reader=stream.getReader();
    while(true){
      const {value,done}=await reader.read();
      if(done)break;
      total+=value.byteLength;
      if(total>expected){await reader.cancel();return reject("decompressed_oversize");}
      chunks.push(value);
    }
    if(total!==expected)return reject("decompressed_length");
    decoded=new Uint8Array(total);let o=0;
    for(const chunk of chunks){decoded.set(chunk,o);o+=chunk.length;}
  }catch(e){
    if(e instanceof Error && e.message.startsWith("image_pixel_qa_"))throw e;
    return reject("decompression");
  }
  let current=new Uint8Array(stride),previous=new Uint8Array(stride);
  let cursor=0,clear=0,opaque=0,foreground=0,magenta=0;
  let minX=width,minY=height,maxX=-1,maxY=-1;
  const corners=[[0,0],[width-1,0],[0,height-1],[width-1,height-1]];
  let nonClearCorners=0;
  for(let y=0;y<height;y++){
    const filter=decoded[cursor++];
    if(filter>4)return reject("filter");
    for(let j=0;j<stride;j++){
      const left=j>=4?current[j-4]:0,above=previous[j],upLeft=j>=4?previous[j-4]:0;
      let prediction=0;
      if(filter===1)prediction=left;
      else if(filter===2)prediction=above;
      else if(filter===3)prediction=Math.floor((left+above)/2);
      else if(filter===4){
        const q=left+above-upLeft;
        const da=Math.abs(q-left),db=Math.abs(q-above),dc=Math.abs(q-upLeft);
        prediction=da<=db&&da<=dc?left:db<=dc?above:upLeft;
      }
      current[j]=(decoded[cursor++]+prediction)&255;
    }
    for(let x=0;x<width;x++){
      const k=x*4,a=current[k+3];
      if(a<=8)clear++;
      if(a>=250){
        opaque++;
        if(current[k]>=244&&current[k+1]<=14&&current[k+2]>=244)magenta++;
      }
      if(a>=128){
        foreground++;
        minX=Math.min(minX,x);minY=Math.min(minY,y);
        maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
      }
      if(a>8 && corners.some(([cx,cy])=>cx===x&&cy===y))nonClearCorners++;
    }
    const swap=previous;previous=current;current=swap;
  }
  const total=width*height;
  if(nonClearCorners>0 || clear/total <0.05)return reject("transparent_background_missing");
  if(opaque/total<0.02 || foreground/total<0.02)return reject("foreground_missing");
  if(magenta/total>0.002)return reject("magenta_background_not_removed");
  if(slot==="fullBody"){
    const bh=(maxY-minY+1)/height,bw=(maxX-minX+1)/width;
    if(bh<0.62||bw<0.10)return reject("full_body_not_visible");
    if(minX===0||maxX===width-1||minY===0||maxY===height-1)return reject("full_body_cropped");
  }
  return {
    qaVersion:1,technicalPassed:true,width,height,
    transparentFraction:+(clear/total).toFixed(4),
    foregroundFraction:+(foreground/total).toFixed(4),
    bbox:{left:minX,top:minY,right:maxX,bottom:maxY},
    identityVerified:false
  };
}
