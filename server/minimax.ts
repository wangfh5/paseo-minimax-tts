type Voice={apiKey:string;region:string;model:string;voice:string};
// MiniMax accepts under 10,000 characters per request; keep each request small enough that its response stays well under the size guard.
const chunkChars=2000;
// Split at the largest natural boundary in the second half of the window: paragraph, line, sentence, then clause or space.
export function splitText(text:string,limit=chunkChars){
 const parts:string[]=[];let rest=text.trim();
 const levels=[/\n\s*\n/g,/\n/g,/[。！？；!?;]|\.(?=\s)/g,/[，、,:：\s]/g];
 while(rest.length>limit){
  const window=rest.slice(0,limit);let cut=0;
  for(const pattern of levels){for(const match of window.matchAll(pattern)){const end=match.index+match[0].length;if(end>=limit/2)cut=end;}if(cut)break;}
  if(!cut){cut=limit;if(/[\ud800-\udbff]/.test(rest[cut-1]))cut--;}
  parts.push(rest.slice(0,cut).trim());rest=rest.slice(cut).trim();
 }
 if(rest)parts.push(rest);
 return parts.filter(Boolean);
}
async function renderChunk(text:string,settings:Voice,signal:AbortSignal,request:typeof fetch){
 // Each request gets its own 60 second allowance, so long replies are not cut off by a total deadline.
 const limited=new AbortController(),stop=()=>limited.abort(),timer=setTimeout(stop,60000);
 signal.addEventListener("abort",stop,{once:true});if(signal.aborted)stop();
 try{
  const response=await request(settings.region==="cn"?"https://api.minimaxi.com/v1/t2a_v2":"https://api.minimax.io/v1/t2a_v2",{method:"POST",signal:limited.signal,headers:{"Content-Type":"application/json",Authorization:`Bearer ${settings.apiKey}`},body:JSON.stringify({model:settings.model,text,stream:false,output_format:"hex",voice_setting:{voice_id:settings.voice,speed:1,vol:1,pitch:0},audio_setting:{sample_rate:32000,bitrate:128000,format:"mp3",channel:1}})});
  if(!response.ok) throw new Error(`MiniMax HTTP ${response.status}`);
  const reader=response.body?.getReader(); if(!reader) throw new Error("Empty MiniMax response");
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>24*1024*1024){await reader.cancel();throw new Error("MiniMax response exceeds 24 MiB");}chunks.push(value);}
  const body=JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if(body.base_resp?.status_code!==0) throw new Error(`MiniMax rejected request (code ${Number(body.base_resp?.status_code)||"unknown"})`);
  const hex=body.data?.audio;
  if(typeof hex!=="string" || !hex.length || hex.length%2 || !/^[0-9a-f]+$/i.test(hex)) throw new Error("MiniMax returned invalid audio");
  return Buffer.from(hex,"hex");
 }catch(error){
  if(!signal.aborted&&limited.signal.aborted)throw new Error("MiniMax request timed out after 60 seconds");
  throw error;
 }finally{clearTimeout(timer);signal.removeEventListener("abort",stop);}
}
// Bare MP3 frames: MiniMax wraps every response in an ID3v2 tag and a leading Xing/Info frame, which would break or mislead a joined stream.
const kbps=[0,32,40,48,56,64,80,96,112,128,160,192,224,256,320],hertz=[44100,48000,32000];
export function mp3Frames(buf:Buffer){
 let start=0,end=buf.length;
 if(buf.toString("latin1",0,3)==="ID3")start=10+(((buf[6]&0x7f)<<21)|((buf[7]&0x7f)<<14)|((buf[8]&0x7f)<<7)|(buf[9]&0x7f))+(buf[5]&0x10?10:0);
 if(end-start>=128&&buf.toString("latin1",end-128,end-125)==="TAG")end-=128;
 if(buf[start]===0xff&&(buf[start+1]&0xfe)===0xfa){
  const rate=kbps[buf[start+2]>>4],sampling=hertz[(buf[start+2]>>2)&3];
  const info=[21,36].some(at=>/^(Xing|Info)$/.test(buf.toString("latin1",start+at,start+at+4)));
  if(info&&rate&&sampling)start+=Math.floor(144*rate*1000/sampling)+((buf[start+2]>>1)&1);
 }
 return buf.subarray(start,end);
}
// A reply split into several parts can keep finished parts here, so a retry after a failure does not pay for them again.
type PartStore={get(part:string):Promise<string|null>;put(part:string,base64:string):Promise<void>};
// No length limit: long text is synthesized in sequential parts and the MP3 streams are joined in order.
export async function renderSpeech(text:string, settings:Voice,signal:AbortSignal,request:typeof fetch=fetch,store?:PartStore){
 if(!settings.apiKey) throw new Error("Save a MiniMax API key in settings first");
 const parts=splitText(text);
 if(!parts.length) throw new Error("Reply has no text to synthesize");
 const audio:Buffer[]=[];
 for(const part of parts){
  if(signal.aborted)throw new Error("Synthesis canceled");
  const known=parts.length>1?await store?.get(part):null;
  if(known){audio.push(Buffer.from(known,"base64"));continue;}
  const fresh=await renderChunk(part,settings,signal,request);
  if(parts.length>1)await store?.put(part,fresh.toString("base64"));
  audio.push(fresh);
 }
 return {base64:Buffer.concat(audio.length>1?audio.map(mp3Frames):audio).toString("base64"),mimeType:"audio/mpeg" as const};
}
