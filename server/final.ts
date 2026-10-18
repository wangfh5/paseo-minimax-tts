// Only the fields read here. A local type keeps the plugin free of build-time dependencies that consumers would have to install.
type TimelineItem={type:string;text?:string};
// SDK 0.11.4 does not expose assistant channel/final metadata. Conservatively
// select ONLY the last assistant item after the latest user, never join updates.
export function finalReply(timeline:readonly TimelineItem[], outcome:string):string|null {
 if(outcome!=="completed") return null;
 const user=timeline.findLastIndex(x=>x.type==="user_message");
 if(user<0) return null;
 for(let i=timeline.length-1;i>user;i--){
  const item=timeline[i];
  if(item.type==="plugin" || item.type==="notification" || item.type==="todo") continue;
  return (item.type==="assistant_message"?item.text?.trim():"")||null;
 }
 return null;
}
