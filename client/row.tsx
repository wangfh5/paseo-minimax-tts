import { useEffect,useState,useSyncExternalStore } from "react";
import { Pressable,Text,View } from "react-native";
import type { PluginClientContext,PluginTimelineItemProps } from "@getpaseo/plugin/client";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { synthesize,speechStatus,cancel,modeOptions,type Mode } from "../shared/tts";
import * as player from "./web";
import * as modes from "./modes";
import { IconButton,Progress,Segmented,clock } from "./controls";
const icons:Record<Mode,string>={off:"VolumeX",synthesize:"Volume1",play:"Volume2"};
const names:Record<Mode,string>={off:"off",synthesize:"synthesize",play:"play"};
// Inline player drawn under a completed reply; the audio itself is the single shared player.
export function SpeechRow({theme,agentId,item,rpc}:PluginTimelineItemProps<{replyId:string}>&{rpc:PluginClientContext["rpc"]}){
 const audio=useSyncExternalStore(player.subscribe,player.snapshot);
 const config=useSyncExternalStore(modes.subscribe,modes.snapshot);
 const [busy,setBusy]=useState(false),[failure,setFailure]=useState(""),[open,setOpen]=useState(false),[state,setState]=useState<"idle"|"working"|"ready"|"expired">("idle");
 const id=item.data.replyId,mine=audio.id===id,c=theme.colors;
 useEffect(()=>{void modes.refresh(rpc).catch(()=>{});},[rpc]);
 // Whether the daemon already holds this reply's audio; poll only while it is still being synthesized.
 useEffect(()=>{let stopped=false,timer:ReturnType<typeof setTimeout>|undefined;const check=async()=>{try{const next=await rpc(speechStatus,{id});if(stopped)return;setState(next.state);if(next.state==="working")timer=setTimeout(()=>void check(),1000);}catch{}};void check();return()=>{stopped=true;clearTimeout(timer);};},[rpc,id]);
 if(!player.supported())return null;
 const effective=config?.chats[agentId]??config?.auto??"off";
 const press=()=>{
  if(mine){void player.toggle().catch(()=>setFailure("Playback failed"));return;}
  setBusy(true);setFailure("");
  rpc(synthesize,{id}).then(speech=>{setState("ready");return player.play(speech.base64,id);}).catch(e=>{setState("idle");setFailure(e.message);}).finally(()=>setBusy(false));
 };
 const muted={color:c.foregroundMuted,fontSize:13};
 return <View style={{gap:6,paddingVertical:6}}>
  <View style={{flexDirection:"row",flexWrap:"wrap",alignItems:"center",gap:12}}>
   {busy?<IconButton theme={theme} icon="X" label="Cancel synthesis" onPress={()=>{void rpc(cancel,{id});}}/>:<IconButton theme={theme} icon={mine&&audio.playing?"Pause":"Play"} label={mine&&audio.playing?"Pause":"Play"} onPress={press} disabled={state==="expired"&&!mine}/>}
   {mine?<><View style={{width:"33%",minWidth:120,flexDirection:"row"}}><Progress theme={theme} audio={audio}/></View><Text style={muted}>{clock(audio.position)} / {clock(audio.duration)}</Text></>:busy||state==="working"?<Text style={muted}>Synthesizing…</Text>:state==="ready"?<View style={{flexDirection:"row",alignItems:"center",gap:4}}><Icon name="Check" size={14} color={c.statusSuccess}/><Text style={{...muted,color:c.statusSuccess}}>Ready</Text></View>:<Text style={muted}>{state==="expired"?"Expired":"Read aloud"}</Text>}
   {config&&<Pressable accessibilityRole="button" accessibilityLabel="Automatic speech for this chat" accessibilityState={{expanded:open}} onPress={()=>setOpen(!open)} style={{marginLeft:"auto",flexDirection:"row",alignItems:"center",gap:4}}><Icon name={icons[effective]} size={14} color={c.foregroundMuted}/><Text style={muted}>Auto: {names[effective]}</Text></Pressable>}
  </View>
  {open&&config&&<View style={{alignSelf:"flex-end",width:"50%",minWidth:240,gap:6}}>
   <Segmented theme={theme} value={effective} options={modeOptions} onChange={mode=>{void modes.setChat(rpc,agentId,mode).catch(e=>setFailure(e.message));}}/>
   <Text style={{...muted,textAlign:"right"}}>This chat only. Applies to replies that finish from now on.</Text>
  </View>}
  {!!(failure||(mine&&audio.error))&&<Text style={{color:c.statusDanger,fontSize:13}}>{failure||audio.error}</Text>}
 </View>;
}
