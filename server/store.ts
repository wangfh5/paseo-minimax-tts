import { mkdir, readFile, writeFile, rename, chmod } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { defaults, settingsSchema, chatsSchema } from "../shared/tts";
export const storageDir=join(homedir(),".paseo-minimax-tts");
export async function loadSettings(dir=storageDir){
 try { const raw=JSON.parse(await readFile(join(dir,"settings.json"),"utf8")); return {...settingsSchema.parse({...raw,auto:raw.auto??(raw.alwaysOn===true?"play":"off")}),apiKey:typeof raw.apiKey==="string"?raw.apiKey:"",chats:chatsSchema.catch({}).parse(raw.chats)}; }
 catch(e){if((e as NodeJS.ErrnoException).code==="ENOENT") return {...defaults,apiKey:"",chats:{}};throw new Error("Cannot read MiniMax settings");}
}
export async function persistSettings(value:Awaited<ReturnType<typeof loadSettings>>,dir=storageDir){
 await mkdir(dir,{recursive:true,mode:0o700}); await chmod(dir,0o700);
 const temp=join(dir,"settings.tmp");await writeFile(temp,JSON.stringify(value),{mode:0o600});await chmod(temp,0o600);await rename(temp,join(dir,"settings.json"));
}
