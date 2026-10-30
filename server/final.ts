// Only the fields read here. A local type keeps the plugin free of build-time dependencies that consumers would have to install.
type TimelineItem={type:string;text?:string};
type Timeline={refetch(options:{direction:"tail";limit:number}):Promise<{entries:readonly {turnId?:string;item:TimelineItem}[]}>};
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
// Since Paseo 0.14 agent.turn_ended carries no timeline. Wide enough to reach the turn's user message: without it nothing is spoken.
export async function turnReply(timeline:Timeline, outcome:string, turnId:string|null):Promise<string|null> {
 if(outcome!=="completed") return null;
 const {entries}=await timeline.refetch({direction:"tail",limit:200});
 // The next turn may already have started, so stop at this turn's last entry. Not a filter: a user message can lack a turn id.
 const end=turnId===null?entries.length:entries.findLastIndex(x=>x.turnId===turnId)+1;
 return finalReply(entries.slice(0,end).map(x=>x.item),outcome);
}
