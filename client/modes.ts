import type { PluginClientContext } from "@getpaseo/plugin/client";
import { getModes,setChatMode,type Mode } from "../shared/tts";
type Rpc=PluginClientContext["rpc"];
type Modes={auto:Mode;chats:Record<string,Mode>};
// One shared copy so every player row of a chat shows the same override.
let state:Modes|null=null,loading:Promise<void>|null=null;
const listeners=new Set<()=>void>();
const publish=(next:Modes)=>{state=next;for(const fn of listeners)fn();};
export function subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};}
export function snapshot(){return state;}
export function refresh(rpc:Rpc){return loading??=rpc(getModes,{}).then(publish).finally(()=>{loading=null;});}
export function setChat(rpc:Rpc,agentId:string,mode:Mode){return rpc(setChatMode,{agentId,mode}).then(publish);}
