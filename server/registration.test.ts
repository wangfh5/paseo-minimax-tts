import test from "node:test";
import assert from "node:assert/strict";
import { registerWhile } from "../client/registration";
test("a contribution is registered only while wanted, once, and removed when no longer wanted",()=>{
 let wanted=false,registered=0,removed=0;const listeners=new Set<()=>void>();
 const notify=()=>{for(const fn of [...listeners])fn();};
 const cleanup=registerWhile(()=>wanted,()=>{registered++;return()=>{removed++;};},fn=>{listeners.add(fn);return()=>{listeners.delete(fn);};});
 assert.equal(registered,0,"nothing is registered while idle");
 wanted=true;notify();notify();notify();assert.equal(registered,1,"repeated notifications do not register twice");
 wanted=false;notify();notify();assert.equal(removed,1,"it is removed once when no longer wanted");
 wanted=true;notify();assert.equal(registered,2,"it comes back when wanted again");
 cleanup();assert.equal(removed,2,"cleanup removes what is still registered");
 assert.equal(listeners.size,0,"cleanup stops listening");
 wanted=false;notify();assert.equal(removed,2);
});
test("cleanup while idle removes nothing",()=>{
 let removed=0;const cleanup=registerWhile(()=>false,()=>()=>{removed++;},()=>()=>{});cleanup();assert.equal(removed,0);
});
