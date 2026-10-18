// The chat an agent update says is gone: archived, or removed from the list. Anything else is null.
export function goneAgentId(update:{kind:string;agentId?:string;agent?:{id:string;archivedAt?:string|null}}){
 if(update.kind==="remove")return update.agentId??null;
 if(update.kind==="upsert"&&update.agent?.archivedAt)return update.agent.id;
 return null;
}
