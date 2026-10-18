// Keeps a contribution registered only while it is wanted. A sidebar item that merely renders nothing still leaves an empty strip behind, so it has to be removed.
export function registerWhile(active:()=>boolean,register:()=>()=>void|Promise<void>,subscribe:(onChange:()=>void)=>()=>void){
 let remove:(()=>void|Promise<void>)|undefined;
 const sync=()=>{
  const wanted=active();
  if(wanted&&!remove)remove=register();
  else if(!wanted&&remove){const undo=remove;remove=undefined;void undo();}
 };
 const unsubscribe=subscribe(sync);sync();
 return()=>{unsubscribe();const undo=remove;remove=undefined;void undo?.();};
}
