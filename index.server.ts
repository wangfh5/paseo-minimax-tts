import type { PluginServerContext } from "@getpaseo/plugin/server";
import { randomUUID } from "node:crypto";
import { getSettings,saveSettings,getModes,setChatMode,listReplies,synthesize,speechStatus,cancel,speechKind,type Mode } from "./shared/tts";
import { loadSettings,persistSettings } from "./server/store";
import { finalReply } from "./server/final";
import { renderSpeech } from "./server/minimax";
type Settings=Awaited<ReturnType<typeof loadSettings>>;
type Speech=Awaited<ReturnType<typeof renderSpeech>>;
export default function contribute(server:PluginServerContext){
 const replies:Array<{id:string;agentId:string;title:string;text:string;createdAt:number;auto:Mode}>=[];
 const cache=new Map<string,Speech>();
 const jobs=new Map<string,{done:Promise<Speech>;controller:AbortController}>();
 let saving:Promise<unknown>=Promise.resolve();
 const change=(edit:(old:Settings)=>Settings)=>{const run=saving.catch(()=>{}).then(async()=>{const next=edit(await loadSettings());await persistSettings(next);return next;});saving=run;return run;};
 const modes=({auto,chats}:Settings)=>({auto,chats});
 const stop=(id?:string)=>{for(const [key,job] of jobs)if(!id||key===id)job.controller.abort();};
 // One synthesis per reply: manual Play, auto-synthesis and auto-play all share the cache and the running job.
 const speak=(id:string):Promise<Speech>=>{
  const hit=cache.get(id);if(hit)return Promise.resolve(hit);
  const running=jobs.get(id);if(running)return running.done;
  const reply=replies.find(x=>x.id===id);if(!reply)return Promise.reject(new Error("Reply expired or unavailable; only live completed turns are collected"));
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
  const done=loadSettings().then(settings=>renderSpeech(reply.text,settings,controller.signal))
   .then(audio=>{if(controller.signal.aborted)throw new Error("Synthesis canceled");cache.set(id,audio);while(cache.size>3)cache.delete(cache.keys().next().value!);return audio;})
   .catch(error=>{throw controller.signal.aborted?new Error("Synthesis canceled or timed out"):error;})
   .finally(()=>{clearTimeout(timer);jobs.delete(id);});
  jobs.set(id,{done,controller});return done;
 };
 server.handle(getSettings,async()=>{const {apiKey,chats,...publicSettings}=await loadSettings();return {...publicSettings,hasKey:!!apiKey};});
 server.handle(saveSettings,async input=>{const {apiKey,clearKey,...settings}=input;stop();cache.clear();await change(old=>({...old,...settings,apiKey:clearKey?"":apiKey?.trim()||old.apiKey}));return {ok:true};});
 server.handle(getModes,async()=>modes(await loadSettings()));
 server.handle(setChatMode,async({agentId,mode})=>modes(await change(old=>{return {...old,chats:{...old.chats,[agentId]:mode}};})));
 server.handle(listReplies,()=>({items:[...replies].reverse()}));
 server.handle(cancel,({id})=>{stop(id);return {ok:true};});
 server.handle(synthesize,({id})=>speak(id));
 server.handle(speechStatus,({id})=>({state:cache.has(id)?"ready" as const:jobs.has(id)?"working" as const:replies.some(x=>x.id===id)?"idle" as const:"expired" as const}));
 // No history subscription or reconnect replay. Only lifecycle completion events.
 server.on("agent.turn_ended",async(event,{paseo})=>{
  const text=finalReply(event.timeline,event.outcome.kind);if(!text)return;
  const settings=await loadSettings().catch(()=>null);
  const id=randomUUID(),auto:Mode=settings?settings.chats[event.agent.id]??settings.auto:"off";
  replies.push({id,agentId:event.agent.id,title:event.agent.title||event.agent.id,text,createdAt:Date.now(),auto});
  while(replies.length>20){cache.delete(replies.shift()!.id);}
  if(auto!=="off")void speak(id).catch(error=>console.error("MiniMax auto synthesis failed:",String(error)));
  // The inline player row under the reply.
  await paseo.agents.ref(event.agent.id).timeline.append({type:"plugin",id,kind:speechKind,version:1,data:{replyId:id}}).catch(error=>console.error("MiniMax timeline row failed",error));
 });
 return ()=>{stop();cache.clear();replies.length=0;};
}
