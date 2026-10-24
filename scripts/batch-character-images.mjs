#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { bulkImportCharacters } from "../server/image-pipeline/batch.mjs";

function argsOf(argv){
  const opts=new Map();
  for(let i=0;i<argv.length;i++){
    const a=argv[i];if(!a.startsWith("--"))throw Error("Unexpected argument "+a);
    if(["--apply","--local-only"].includes(a)){opts.set(a,true);continue;}
    if(!argv[i+1]||argv[i+1].startsWith("--"))throw Error("Missing value for "+a);
    opts.set(a,argv[++i]);
  }
  return opts;
}
try {
  const flags=argsOf(process.argv.slice(2));
  if(!flags.has("--source")||!flags.has("--registry"))
    throw Error("Required: --source FOLDER --registry PRIVATE_JSON [--destination imagekit|game-db] [--apply]");
  const registry=JSON.parse(await readFile(flags.get("--registry"),"utf8"));
  const destination=flags.get("--destination")??"imagekit";
  const cfg={
    googleFolderId:process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID,
    googleAccessToken:process.env.GOOGLE_DRIVE_ACCESS_TOKEN,
    googleRefreshToken:process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
    googleClientId:process.env.GOOGLE_OAUTH_CLIENT_ID,
    googleClientSecret:process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    imagekitPrivateKey:process.env.IMAGEKIT_PRIVATE_KEY,
    imagekitEndpoint:process.env.IMAGEKIT_URL_ENDPOINT??process.env.VITE_IMAGEKIT_URL_ENDPOINT,
    gameApiOrigin:process.env.NANAL_GAME_API_ORIGIN,
    adminToken:process.env.NANAL_APPEARANCE_ADMIN_TOKEN
  };
  const report=await bulkImportCharacters({
    root:flags.get("--source"),registry,destination,
    dryRun:!flags.has("--apply"),localOnly:flags.has("--local-only"),
    privateRoot:".nanal-private",catalogPath:"src/assets/character-portraits/catalog.json"
  },cfg);
  const reportPath=path.resolve(flags.get("--report")??".nanal-private/last-image-batch-report.json");
  await mkdir(path.dirname(reportPath),{recursive:true});
  await writeFile(reportPath,JSON.stringify(report,null,2)+"\n",{mode:0o600});
  console.log(JSON.stringify({mode:report.mode,destination,found:report.found,
    ignored:report.ignored.length,completed:report.completed,failed:report.failed,report:reportPath},null,2));
  if(report.failed)process.exitCode=1;
} catch(e) {console.error("Batch image import failed: "+(e instanceof Error?e.message:String(e)));process.exitCode=1;}
