import type { PluginClientContext } from "@getpaseo/plugin/client";
import { listReplies,synthesize } from "../shared/tts";
import * as player from "./web";
// Runs while the plugin is loaded: plays new replies the daemon marked auto-play, never the initial snapshot.
export function startAutoplay(rpc:PluginClientContext["rpc"]){
 let seen:Set<string>|null=null,stopped=false,busy=false;
 const poll=async()=>{if(busy)return;busy=true;try{
  const data=await rpc(listReplies,{});if(stopped)return;
  const fresh=data.items.filter(x=>seen&&!seen.has(x.id));seen=new Set(data.items.map(x=>x.id));
  const next=fresh.find(x=>x.auto==="play");
  if(next&&player.supported()){const audio=await rpc(synthesize,{id:next.id});if(!stopped)await player.play(audio.base64,next.id);}
 }catch{seen=null;}finally{busy=false;}};
 void poll();const timer=setInterval(()=>void poll(),3000);
 return()=>{stopped=true;clearInterval(timer);};
}
