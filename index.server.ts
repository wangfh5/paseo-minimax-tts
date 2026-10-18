import type { PluginServerContext } from "@getpaseo/plugin/server";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { getSettings,saveSettings,getModes,setChatMode,listReplies,synthesize,speechStatus,cancel,speechKind,type Mode } from "./shared/tts";
import { loadSettings,persistSettings,storageDir } from "./server/store";
import { audioCache } from "./server/cache";
import { finalReply } from "./server/final";
import { renderSpeech } from "./server/minimax";
type Settings=Awaited<ReturnType<typeof loadSettings>>;
type Speech=Awaited<ReturnType<typeof renderSpeech>>;
export default function contribute(server:PluginServerContext){
 const replies:Array<{id:string;agentId:string;title:string;text:string;createdAt:number;auto:Mode}>=[];
 // Audio survives reloads and restarts; the key includes model and voice so changing them never replays old audio.
 const cache=audioCache(join(storageDir,"audio"),512*1024*1024);
 const cacheKey=({model,voice}:Settings,id:string)=>`${model}\0${voice}\0${id}`;
 const jobs=new Map<string,{done:Promise<Speech>;controller:AbortController}>();
 let saving:Promise<unknown>=Promise.resolve();
 const change=(edit:(old:Settings)=>Settings)=>{const run=saving.catch(()=>{}).then(async()=>{const next=edit(await loadSettings());await persistSettings(next);return next;});saving=run;return run;};
 const modes=({auto,chats}:Settings)=>({auto,chats});
 const stop=(id?:string)=>{for(const [key,job] of jobs)if(!id||key===id)job.controller.abort();};
 // One job per reply: manual Play, auto-synthesis and auto-play share the cached audio and the running job.
 const speak=(id:string):Promise<Speech>=>{
  const running=jobs.get(id);if(running)return running.done;
  const controller=new AbortController();
  const done=(async()=>{
   const settings=await loadSettings(),key=cacheKey(settings,id),hit=await cache.get(key);
   if(hit)return {base64:hit,mimeType:"audio/mpeg" as const};
   const reply=replies.find(x=>x.id===id);if(!reply)throw new Error("Reply expired or unavailable; only live completed turns are collected");
   const audio=await renderSpeech(reply.text,settings,controller.signal);
   if(controller.signal.aborted)throw new Error("Synthesis canceled");
   await cache.put(key,audio.base64);return audio;
  })().catch(error=>{throw controller.signal.aborted?new Error("Synthesis canceled"):error;}).finally(()=>{jobs.delete(id);});
  jobs.set(id,{done,controller});return done;
 };
 server.handle(getSettings,async()=>{const {apiKey,chats,...publicSettings}=await loadSettings();return {...publicSettings,hasKey:!!apiKey};});
 server.handle(saveSettings,async input=>{const {apiKey,clearKey,...settings}=input;stop();await change(old=>({...old,...settings,apiKey:clearKey?"":apiKey?.trim()||old.apiKey}));return {ok:true};});
 server.handle(getModes,async()=>modes(await loadSettings()));
 server.handle(setChatMode,async({agentId,mode})=>modes(await change(old=>{return {...old,chats:{...old.chats,[agentId]:mode}};})));
 server.handle(listReplies,()=>({items:[...replies].reverse()}));
 server.handle(cancel,({id})=>{stop(id);return {ok:true};});
 server.handle(synthesize,({id})=>speak(id));
 server.handle(speechStatus,async({id})=>({state:await cache.has(cacheKey(await loadSettings(),id))?"ready" as const:jobs.has(id)?"working" as const:replies.some(x=>x.id===id)?"idle" as const:"expired" as const}));
 // No history subscription or reconnect replay. Only lifecycle completion events.
 server.on("agent.turn_ended",async(event,{paseo})=>{
  const text=finalReply(event.timeline,event.outcome.kind);if(!text)return;
  const settings=await loadSettings().catch(()=>null);
  const id=randomUUID(),auto:Mode=settings?settings.chats[event.agent.id]??settings.auto:"off";
  replies.push({id,agentId:event.agent.id,title:event.agent.title||event.agent.id,text,createdAt:Date.now(),auto});
  while(replies.length>20)replies.shift();
  if(auto!=="off")void speak(id).catch(error=>console.error("MiniMax auto synthesis failed:",String(error)));
  // The inline player row under the reply.
  await paseo.agents.ref(event.agent.id).timeline.append({type:"plugin",id,kind:speechKind,version:1,data:{replyId:id}}).catch(error=>console.error("MiniMax timeline row failed",error));
 });
 return ()=>{stop();replies.length=0;};
}
