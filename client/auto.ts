import type { PluginClientContext } from "@getpaseo/plugin/client";
import { listReplies,synthesize } from "../shared/tts";
import * as player from "./web";
const sleep=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
// Loaded audio that neither finished nor failed, playing or paused by the user, holds the queue.
const holding=()=>{const now=player.snapshot();return !!now.id&&!now.ended&&!now.error;};
const settle=async(stopped:()=>boolean)=>{while(!stopped()&&holding())await sleep(500);};
// Runs while the plugin is loaded: queues new replies the daemon marked auto-play, never the initial snapshot, and plays them one after another.
export function startAutoplay(rpc:PluginClientContext["rpc"]){
 let seen:Set<string>|null=null,stopped=false,polling=false,draining=false;
 const queue:string[]=[];
 const drain=async()=>{
  if(draining)return;draining=true;
  while(queue.length&&!stopped){
   await settle(()=>stopped);
   const id=queue.shift();if(stopped||!id)break;
   // Audio the user started while this reply was being fetched must not be replaced, so wait again before playing.
   try{const audio=await rpc(synthesize,{id});await settle(()=>stopped);if(!stopped)await player.play(audio.base64,id);}catch{}
  }
  draining=false;
 };
 const poll=async()=>{if(polling)return;polling=true;try{
  const data=await rpc(listReplies,{});if(stopped)return;
  const fresh=data.items.filter(x=>seen&&!seen.has(x.id));seen=new Set(data.items.map(x=>x.id));
  if(player.supported()){queue.push(...fresh.filter(x=>x.auto==="play").map(x=>x.id).reverse());void drain();}
 }catch{seen=null;}finally{polling=false;}};
 void poll();const timer=setInterval(()=>void poll(),3000);
 return()=>{stopped=true;queue.length=0;clearInterval(timer);};
}
