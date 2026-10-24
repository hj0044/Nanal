#!/usr/bin/env node
import {importCharacterImage} from "../server/image-pipeline/import.mjs";
const args=new Map();
for(let i=2;i<process.argv.length;i++){
  const key=process.argv[i];
  if(!key.startsWith("--"))throw Error("Unexpected argument: "+key);
  if(["--dry-run","--local-only"].includes(key)){args.set(key,true);continue;}
  if(!process.argv[i+1]||process.argv[i+1].startsWith("--"))throw Error("Missing "+key);
  args.set(key,process.argv[++i]);
}
const spec={
  filePath:args.get("--file"),characterId:args.get("--character"),kind:args.get("--kind"),
  index:Number(args.get("--index")),gender:args.get("--gender"),
  ageMin:Number(args.get("--age-min")),ageMax:Number(args.get("--age-max")),
  anchorSha256:args.get("--anchor-sha256"),
  dryRun:Boolean(args.get("--dry-run")),localOnly:Boolean(args.get("--local-only"))
};
const config={
  googleFolderId:process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID,
  googleAccessToken:process.env.GOOGLE_DRIVE_ACCESS_TOKEN,
  googleRefreshToken:process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
  googleClientId:process.env.GOOGLE_OAUTH_CLIENT_ID,
  googleClientSecret:process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  imagekitPrivateKey:process.env.IMAGEKIT_PRIVATE_KEY,
  imagekitEndpoint:process.env.IMAGEKIT_URL_ENDPOINT||process.env.VITE_IMAGEKIT_URL_ENDPOINT
};
try{console.log(JSON.stringify(await importCharacterImage(spec,config),null,2));}
catch(error){console.error("Image import failed: "+error.message);process.exitCode=1;}
