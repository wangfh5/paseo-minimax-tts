import type { PluginClientContext } from "@getpaseo/plugin/client";
import * as player from "./web";
import { dropQueued } from "./auto";
import { goneAgentId } from "./gone";
// Stops audio that belongs to a chat once that chat is archived or deleted, and forgets its queued replies.
export function stopWhenChatGone(client:PluginClientContext){
 const lifetime=new AbortController();
 void client.paseo.agents.list({subscribe:{},signal:lifetime.signal}).then(({subscription})=>{
  subscription.subscribe({
   snapshot:()=>{},
   update:message=>{
    if(message.type!=="agent_update")return;
    const gone=goneAgentId(message.payload);if(!gone)return;
    dropQueued(gone);if(player.snapshot().agentId===gone)player.dispose();
   },
  });
 }).catch(error=>{if(!lifetime.signal.aborted)console.error("MiniMax chat watcher failed",error);});
 return()=>lifetime.abort();
}
