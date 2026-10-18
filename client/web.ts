import { Platform } from "react-native";
interface AudioFile {currentTime:number;duration:number;paused:boolean;src:string;play():Promise<void>;pause():void;load():void;ontimeupdate:(()=>void)|null;onloadedmetadata:(()=>void)|null;onended:(()=>void)|null;onerror:(()=>void)|null;}
declare const Audio: new (src:string)=>AudioFile;
let audio:AudioFile|undefined;
const listeners=new Set<()=>void>();
let state={id:"",position:0,duration:0,playing:false,error:""};
function notify(){for(const fn of listeners)fn();}
export function subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};}
export function snapshot(){return state;}
export function supported(){return Platform.OS==="web";}
export function dispose(){if(!supported())return;if(audio){audio.ontimeupdate=audio.onloadedmetadata=audio.onended=audio.onerror=null;audio.pause();audio.src="";audio.load();audio=undefined;}state={id:"",position:0,duration:0,playing:false,error:""};notify();}
export async function play(base64:string,id=""){if(!supported())throw new Error("Seekable playback requires desktop or web");dispose();state={...state,id};audio=new Audio(`data:audio/mpeg;base64,${base64}`);const current=audio;
 const update=()=>{state={...state,position:current.currentTime,duration:Number.isFinite(current.duration)?current.duration:0,playing:!current.paused};notify();};
 current.ontimeupdate=update;current.onloadedmetadata=update;current.onended=update;current.onerror=()=>{state={...state,error:"Audio decode/playback failed"};notify();};
 try{await current.play();update();}catch{state={...state,error:"Autoplay blocked. Press Play to start playback."};notify();}
}
export async function toggle(){if(!supported()||!audio)return;if(audio.paused){await audio.play();}else audio.pause();state={...state,playing:!audio.paused,error:""};notify();}
export function seek(ratio:number){if(!supported()||!audio||!Number.isFinite(audio.duration))return;audio.currentTime=Math.max(0,Math.min(1,ratio))*audio.duration;state={...state,position:audio.currentTime};notify();}
