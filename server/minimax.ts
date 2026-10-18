export async function renderSpeech(text:string, settings:{apiKey:string;region:string;model:string;voice:string},signal:AbortSignal,request:typeof fetch=fetch){
 if(!settings.apiKey) throw new Error("Save a MiniMax API key in settings first");
 if(!text.trim() || text.length>8000) throw new Error("Reply must contain 1–8000 characters; no silent truncation");
 const response=await request(settings.region==="cn"?"https://api.minimaxi.com/v1/t2a_v2":"https://api.minimax.io/v1/t2a_v2",{method:"POST",signal,headers:{"Content-Type":"application/json",Authorization:`Bearer ${settings.apiKey}`},body:JSON.stringify({model:settings.model,text,stream:false,output_format:"hex",voice_setting:{voice_id:settings.voice,speed:1,vol:1,pitch:0},audio_setting:{sample_rate:32000,bitrate:128000,format:"mp3",channel:1}})});
 if(!response.ok) throw new Error(`MiniMax HTTP ${response.status}`);
 const reader=response.body?.getReader(); if(!reader) throw new Error("Empty MiniMax response");
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>24*1024*1024){await reader.cancel();throw new Error("MiniMax response exceeds 24 MiB");}chunks.push(value);}
 const body=JSON.parse(Buffer.concat(chunks).toString("utf8"));
 if(body.base_resp?.status_code!==0) throw new Error(`MiniMax rejected request (code ${Number(body.base_resp?.status_code)||"unknown"})`);
 const hex=body.data?.audio;
 if(typeof hex!=="string" || !hex.length || hex.length%2 || !/^[0-9a-f]+$/i.test(hex)) throw new Error("MiniMax returned invalid audio");
 return {base64:Buffer.from(hex,"hex").toString("base64"),mimeType:"audio/mpeg" as const};
}
