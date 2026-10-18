import type { PluginServerContext } from "@getpaseo/plugin/server";
import { randomUUID } from "node:crypto";
import { getSettings,saveSettings,listReplies,synthesize,cancel } from "./shared/tts";
import { loadSettings,persistSettings } from "./server/store";
import { finalReply } from "./server/final";
import { renderSpeech } from "./server/minimax";
export default function contribute(server:PluginServerContext){
 const replies:Array<{id:string;agentId:string;title:string;text:string;createdAt:number}>=[];
 const cache=new Map<string,Awaited<ReturnType<typeof renderSpeech>>>();
 let active:AbortController|undefined;
 let saving=Promise.resolve();
 server.handle(getSettings,async()=>{const {apiKey,...publicSettings}=await loadSettings();return {...publicSettings,hasKey:!!apiKey};});
 server.handle(saveSettings,async input=>{saving=saving.catch(()=>{}).then(async()=>{const old=await loadSettings();const {apiKey,clearKey,...settings}=input;active?.abort();cache.clear();await persistSettings({...settings,apiKey:clearKey?"":apiKey?.trim()||old.apiKey});});await saving;return {ok:true};});
 server.handle(listReplies,()=>({items:[...replies].reverse()}));
 server.handle(cancel,()=>{active?.abort();return {ok:true};});
 server.handle(synthesize,async({id})=>{
  const reply=replies.find(x=>x.id===id);if(!reply)throw new Error("Reply expired or unavailable; only live completed turns are collected");
  if(cache.has(id))return cache.get(id)!;
  if(active)throw new Error("Synthesis busy; cancel or wait before trying again");
  const controller=new AbortController();active=controller;const timer=setTimeout(()=>controller.abort(),60000);
  try{const audio=await renderSpeech(reply.text,await loadSettings(),controller.signal);if(controller.signal.aborted)throw new Error("Synthesis canceled");cache.set(id,audio);while(cache.size>3)cache.delete(cache.keys().next().value!);return audio;}
  catch(error){if(controller.signal.aborted)throw new Error("Synthesis canceled or timed out");throw error;}
  finally{clearTimeout(timer);active=undefined;}
 });
 // No history subscription or reconnect replay. Only lifecycle completion events.
 server.on("agent.turn_ended",event=>{
  const text=finalReply(event.timeline,event.outcome.kind);if(!text)return;
  replies.push({id:randomUUID(),agentId:event.agent.id,title:event.agent.title||event.agent.id,text,createdAt:Date.now()});
  while(replies.length>20){cache.delete(replies.shift()!.id);}
 });
 return ()=>{active?.abort();cache.clear();replies.length=0;};
}
