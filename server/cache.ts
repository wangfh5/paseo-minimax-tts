import { mkdir,readFile,writeFile,readdir,stat,unlink,rename,utimes,chmod } from "node:fs/promises";
import { createHash,randomUUID } from "node:crypto";
import { join } from "node:path";
// Audio files named by a hash of the key, so a key can never escape the directory. Least recently used files go first once the total exceeds the limit.
export function audioCache(dir:string){
 const file=(key:string)=>join(dir,`${createHash("sha256").update(key).digest("hex")}.mp3`);
 // A file can vanish between listing and stat when another job is evicting, cleaning up or clearing.
 const list=async()=>{
  const names=await readdir(dir).catch(()=>[] as string[]);
  const items=await Promise.all(names.filter(name=>name.endsWith(".mp3")).map(name=>{const path=join(dir,name);return stat(path).then(info=>({path,size:info.size,mtimeMs:info.mtimeMs}),()=>null);}));
  return items.filter(item=>item!==null);
 };
 // The file just written is counted first, so the total never exceeds the limit even when other files carry newer timestamps.
 async function trim(limit:number,keep?:string){
  const files=await list(),pinned=files.find(item=>item.path===keep);
  let total=pinned?.size??0;
  for(const item of files.filter(item=>item!==pinned).sort((a,b)=>b.mtimeMs-a.mtimeMs)){total+=item.size;if(total>limit)await unlink(item.path).catch(()=>{});}
 }
 return {
  trim,
  async has(key:string){return stat(file(key)).then(()=>true,()=>false);},
  async get(key:string){
   const path=file(key),data=await readFile(path).catch(()=>null);
   if(!data)return null;
   const now=new Date();await utimes(path,now,now).catch(()=>{});// best effort: the file may be evicted right after the read, and the bytes are already in hand
   return data.toString("base64");
  },
  async put(key:string,base64:string,limit:number){
   const data=Buffer.from(base64,"base64");
   if(data.length>limit)return;// the limit is a hard cap, so one oversized file is simply not cached
   await mkdir(dir,{recursive:true,mode:0o700});await chmod(dir,0o700);
   const path=file(key),temp=`${path}.${randomUUID()}.tmp`;await writeFile(temp,data,{mode:0o600});await rename(temp,path);await trim(limit,path);
  },
  async remove(key:string){await unlink(file(key)).catch(()=>{});},
  async stats(){const files=await list();return {files:files.length,bytes:files.reduce((sum,item)=>sum+item.size,0)};},
  async clear(){for(const item of await list())await unlink(item.path).catch(()=>{});return this.stats();},
 };
}
