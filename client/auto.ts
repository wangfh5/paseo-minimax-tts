import type { PluginClientContext } from "@getpaseo/plugin/client";
import { getSettings,listReplies,synthesize } from "../shared/tts";
import * as player from "./web";
// Runs while the plugin is loaded: autoplay observes new live replies, never the initial snapshot.
export function startAutoplay(rpc:PluginClientContext["rpc"]){
 let seen:Set<string>|null=null,stopped=false,busy=false;
 const poll=async()=>{if(busy)return;busy=true;try{
  const [data,config]=await Promise.all([rpc(listReplies,{}),rpc(getSettings,{})]);if(stopped)return;
  const fresh=data.items.filter(x=>seen&&!seen.has(x.id));seen=new Set(data.items.map(x=>x.id));
  if(config.alwaysOn&&player.supported()&&fresh[0]){const audio=await rpc(synthesize,{id:fresh[0].id});if(!stopped)await player.play(audio.base64,fresh[0].id);}
 }catch{seen=null;}finally{busy=false;}};
 void poll();const timer=setInterval(()=>void poll(),3000);
 return()=>{stopped=true;clearInterval(timer);};
}
