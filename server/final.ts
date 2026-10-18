import type { AgentTimelineItem } from "@getpaseo/protocol/agent-types";
// SDK 0.11.4 does not expose assistant channel/final metadata. Conservatively
// select ONLY the last assistant item after the latest user, never join updates.
export function finalReply(timeline:readonly AgentTimelineItem[], outcome:string):string|null {
 if(outcome!=="completed") return null;
 const user=timeline.findLastIndex(x=>x.type==="user_message");
 if(user<0) return null;
 for(let i=timeline.length-1;i>user;i--){
  const item=timeline[i];
  if(item.type==="plugin" || item.type==="notification" || item.type==="todo") continue;
  return item.type==="assistant_message" && item.text.trim() ? item.text.trim():null;
 }
 return null;
}
