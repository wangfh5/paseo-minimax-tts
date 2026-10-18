import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import ts from "typescript";
import {URL} from "node:url";
function load(platform:string){
 let latest:FakeAudio|undefined;
 class FakeAudio{currentTime=0;duration=120;paused=true;src:string;ontimeupdate:any;onloadedmetadata:any;onended:any;onerror:any;constructor(src:string){this.src=src;latest=this;}async play(){this.paused=false;}pause(){this.paused=true;}load(){}}
 const exports:any={};
 const source=ts.transpileModule(readFileSync(new URL("../client/web.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 runInNewContext(source,{exports,require:()=>({Platform:{OS:platform}}),Audio:FakeAudio});return {api:exports,audio:()=>latest};
}
test("seek writes actual media currentTime, clamps, pause and disposal work",async()=>{const {api,audio}=load("web");await api.play("SUQz");assert.equal(audio()?.paused,false);api.seek(0.5);assert.equal(audio()?.currentTime,60);assert.equal(api.snapshot().position,60);api.seek(2);assert.equal(audio()?.currentTime,120);api.seek(-1);assert.equal(audio()?.currentTime,0);await api.toggle();assert.equal(audio()?.paused,true);api.dispose();assert.equal(audio()?.src,"");});
test("native never creates a browser Audio object",async()=>{const {api,audio}=load("ios");assert.equal(api.supported(),false);await assert.rejects(api.play("SUQz"),/desktop or web/);api.seek(0.5);api.dispose();assert.equal(audio(),undefined);});
