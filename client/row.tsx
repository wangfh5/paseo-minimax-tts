import { useState,useSyncExternalStore } from "react";
import { Text,View } from "react-native";
import type { PluginClientContext,PluginTimelineItemProps } from "@getpaseo/plugin/client";
import { synthesize,cancel } from "../shared/tts";
import * as player from "./web";
import { IconButton,Progress,clock } from "./controls";
// Inline player drawn under a completed reply; the audio itself is the single shared player.
export function SpeechRow({theme,item,rpc}:PluginTimelineItemProps<{replyId:string}>&{rpc:PluginClientContext["rpc"]}){
 const audio=useSyncExternalStore(player.subscribe,player.snapshot);
 const [busy,setBusy]=useState(false),[failure,setFailure]=useState("");
 if(!player.supported())return null;
 const id=item.data.replyId,mine=audio.id===id,c=theme.colors;
 const press=()=>{
  if(mine){void player.toggle().catch(()=>setFailure("Playback failed"));return;}
  setBusy(true);setFailure("");
  rpc(synthesize,{id}).then(speech=>player.play(speech.base64,id)).catch(e=>setFailure(e.message)).finally(()=>setBusy(false));
 };
 return <View style={{gap:6,paddingVertical:6}}>
  <View style={{flexDirection:"row",alignItems:"center",gap:12}}>
   {busy?<IconButton theme={theme} icon="X" label="Cancel synthesis" onPress={()=>{void rpc(cancel,{});}}/>:<IconButton theme={theme} icon={mine&&audio.playing?"Pause":"Play"} label={mine&&audio.playing?"Pause":"Play"} onPress={press}/>}
   {mine?<><View style={{width:"33%",minWidth:120,flexDirection:"row"}}><Progress theme={theme} audio={audio}/></View><Text style={{color:c.foregroundMuted,fontSize:13}}>{clock(audio.position)} / {clock(audio.duration)}</Text></>:<Text style={{color:c.foregroundMuted,fontSize:13}}>{busy?"Synthesizing…":"Read aloud"}</Text>}
  </View>
  {!!(failure||(mine&&audio.error))&&<Text style={{color:c.statusDanger,fontSize:13}}>{failure||audio.error}</Text>}
 </View>;
}
