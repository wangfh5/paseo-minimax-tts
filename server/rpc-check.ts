// Explicit diagnostic helper. Does not load credentials or write daemon config.
import { DaemonClient } from "@getpaseo/client/internal/daemon-client";
async function main(){
 const [url,mode]=process.argv.slice(2);
 if(!url)throw new Error("Usage: npx tsx server/rpc-check.ts <daemon-websocket-url> [--synthesize-latest]");
 const client=new DaemonClient({url,clientId:"minimax-tts-verification",clientType:"cli",reconnect:{enabled:false},connectTimeoutMs:10000});
 try{await client.connect();const settings=await client.invokePluginRpc("paseo-minimax-tts","settings.get",{});console.log("Settings (no key readback):",settings);
 const result=await client.invokePluginRpc("paseo-minimax-tts","replies.list",{}) as {items:Array<{id:string;title:string}>};console.log("Completed replies:",result.items.map(({id,title})=>({id,title})));
 if(mode==="--synthesize-latest"){if(!result.items[0])throw new Error("Complete a new agent turn first");const audio=await client.invokePluginRpc("paseo-minimax-tts","speech.synthesize",{id:result.items[0].id}) as {base64:string;mimeType:string};console.log({mimeType:audio.mimeType,bytes:Buffer.from(audio.base64,"base64").length});}
 }finally{await client.close();}
}
main().catch(e=>{console.error(e instanceof Error?e.message:"RPC check failed");process.exitCode=1;});
