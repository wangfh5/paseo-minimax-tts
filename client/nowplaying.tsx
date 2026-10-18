import { useSyncExternalStore } from "react";
import { Pressable,View } from "react-native";
import { useAgent,type PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { Icon } from "@getpaseo/plugin/client/react-native";
import * as player from "./web";
import { clearQueue } from "./auto";
// Global controls for the shared audio. The row is registered only while a reply is loaded and not finished, so playback can be paused or stopped from any page.
export function NowPlaying({theme,openScreen}:PluginSidebarItemProps){
 const audio=useSyncExternalStore(player.subscribe,player.snapshot);
 const title=useAgent(audio.agentId,agent=>agent.title);
 if(!audio.id||audio.ended)return null;
 const toggle=()=>{void player.toggle().catch(()=>{});};
 // Clicking the row goes to the chat that owns the audio, where the progress bar is; the buttons on the right control playback.
 const open=()=>{if(audio.agentId)openScreen({screenId:"jump",params:{agentId:audio.agentId,at:String(Date.now())}});else toggle();};
 const button=(icon:string,label:string,fn:()=>void)=><Pressable accessibilityRole="button" accessibilityLabel={label} onPress={fn} hitSlop={6} style={{padding:4}}><Icon name={icon} size={16} color={theme.colors.foregroundMuted}/></Pressable>;
 return <SidebarRow icon="Volume2" label={`${audio.playing?"":"Paused · "}${title||"Reading aloud"}`} onPress={open} trailing={<View style={{flexDirection:"row",alignItems:"center"}}>{button(audio.playing?"Pause":"Play",audio.playing?"Pause":"Resume",toggle)}{button("X","Stop and clear the queue",()=>{player.dispose();clearQueue();})}</View>}/>;
}
