import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import ts from "typescript";
import {URL} from "node:url";
// Runs client/auto.ts against a fake player, a fake RPC and a manual clock.
function setup(initial:Array<{id:string;auto:string}>){
 let now=0,seq=0;const timers=new Map<number,{at:number;fn:()=>void;every?:number}>();
 const flush=async()=>{for(let i=0;i<10;i++)await new Promise(resolve=>setImmediate(resolve));};
 const clock={
  setTimeout:(fn:()=>void,ms:number)=>{timers.set(++seq,{at:now+ms,fn});return seq;},
  setInterval:(fn:()=>void,ms:number)=>{timers.set(++seq,{at:now+ms,fn,every:ms});return seq;},
  clearInterval:(id:number)=>{timers.delete(id);},clearTimeout:(id:number)=>{timers.delete(id);},
 };
 const advance=async(ms:number)=>{
  const end=now+ms;
  for(;;){let next:number|undefined;for(const [id,timer] of timers)if(timer.at<=end&&(next===undefined||timer.at<timers.get(next)!.at))next=id;if(next===undefined)break;
   const timer=timers.get(next)!;now=timer.at;if(timer.every)timer.at+=timer.every;else timers.delete(next);timer.fn();await flush();}
  now=end;await flush();
 };
 const replies=[...initial],plays:string[]=[];
 const state={id:"",ended:false,error:"",playing:false};
 const web={supported:()=>true,snapshot:()=>state,play:async(_base64:string,id:string)=>{plays.push(id);Object.assign(state,{id,ended:false,error:"",playing:true});}};
 let gate:Promise<void>|null=null;
 const rpc=async(contract:{name:string})=>{if(contract.name==="list")return {items:replies};await gate;return {base64:"x",mimeType:"audio/mpeg"};};
 const exports:any={};
 const source=ts.transpileModule(readFileSync(new URL("../client/auto.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 runInNewContext(source,{exports,require:(name:string)=>name==="./web"?web:{listReplies:{name:"list"},synthesize:{name:"synth"}},...clock});
 const stop=exports.startAutoplay(rpc);
 return {replies,plays,state,advance,flush,stop,hold:()=>{let release=()=>{};gate=new Promise<void>(resolve=>{release=()=>{gate=null;resolve();};});return release;}};
}
test("auto-play queues new replies in order and waits for the current audio to finish",async()=>{
 const h=setup([{id:"old",auto:"play"}]);await h.flush();
 await h.advance(3000);assert.deepEqual(h.plays,[],"initial snapshot is never played");
 h.replies.unshift({id:"A",auto:"play"});await h.advance(3000);assert.deepEqual(h.plays,["A"]);
 h.replies.unshift({id:"C",auto:"off"},{id:"B",auto:"play"});await h.advance(6000);assert.deepEqual(h.plays,["A"],"B waits while A is playing; C is not auto-play");
 h.state.ended=true;await h.advance(1000);assert.deepEqual(h.plays,["A","B"]);
 h.replies.unshift({id:"E",auto:"play"},{id:"D",auto:"play"});await h.advance(3000);assert.deepEqual(h.plays,["A","B"]);
 h.state.ended=true;await h.advance(1000);assert.deepEqual(h.plays,["A","B","D"],"oldest queued reply goes first");
 h.state.ended=true;await h.advance(1000);assert.deepEqual(h.plays,["A","B","D","E"]);
 h.replies.unshift({id:"F",auto:"play"});h.state.playing=false;await h.advance(5000);assert.deepEqual(h.plays,["A","B","D","E"],"a paused reply holds the queue");
 h.state.ended=true;h.state.playing=false;await h.advance(1000);assert.deepEqual(h.plays,["A","B","D","E","F"]);
 h.stop();h.replies.unshift({id:"G",auto:"play"});h.state.ended=true;await h.advance(10000);assert.equal(h.plays.length,5,"nothing plays after stop");
});
test("audio the user starts while a queued reply is being fetched is not replaced",async()=>{
 const h=setup([]);await h.flush();const release=h.hold();
 h.replies.unshift({id:"queued",auto:"play"});await h.advance(3000);assert.deepEqual(h.plays,[],"still waiting for the reply to be fetched");
 Object.assign(h.state,{id:"manual",ended:false,error:"",playing:true});release();await h.advance(3000);assert.deepEqual(h.plays,[],"the manual audio keeps playing");
 h.state.ended=true;await h.advance(1000);assert.deepEqual(h.plays,["queued"]);h.stop();
});
