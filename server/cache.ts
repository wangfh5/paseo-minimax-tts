import { mkdir,readFile,writeFile,readdir,stat,unlink,rename,utimes,chmod } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
// Audio files named by a hash of the key, so a key can never escape the directory. Least recently used files go first once the total exceeds the limit.
export function audioCache(dir:string){
 const file=(key:string)=>join(dir,`${createHash("sha256").update(key).digest("hex")}.mp3`);
 const list=async()=>{
  const names=await readdir(dir).catch(()=>[] as string[]);
  return Promise.all(names.filter(name=>name.endsWith(".mp3")).map(async name=>({path:join(dir,name),...(await stat(join(dir,name)))})));
 };
 async function trim(limit:number,keep?:string){
  let total=0;
  for(const item of (await list()).sort((a,b)=>b.mtimeMs-a.mtimeMs)){total+=item.size;if(total>limit&&item.path!==keep)await unlink(item.path).catch(()=>{});}
 }
 return {
  trim,
  async has(key:string){return stat(file(key)).then(()=>true,()=>false);},
  async get(key:string){try{const path=file(key),data=await readFile(path),now=new Date();await utimes(path,now,now);return data.toString("base64");}catch{return null;}},
  async put(key:string,base64:string,limit:number){
   await mkdir(dir,{recursive:true,mode:0o700});await chmod(dir,0o700);
   const path=file(key),temp=`${path}.tmp`;await writeFile(temp,Buffer.from(base64,"base64"),{mode:0o600});await rename(temp,path);await trim(limit,path);
  },
  async remove(key:string){await unlink(file(key)).catch(()=>{});},
  async stats(){const files=await list();return {files:files.length,bytes:files.reduce((sum,item)=>sum+item.size,0)};},
  async clear(){for(const item of await list())await unlink(item.path).catch(()=>{});return this.stats();},
 };
}
