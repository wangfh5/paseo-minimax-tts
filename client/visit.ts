// Remembers which jump request was already acted on. Going Back to the helper screen remounts it, and without this it would open the chat again and trap the user.
let last="";
export function firstVisit(token:string|undefined){
 if(!token||token===last)return false;
 last=token;return true;
}
