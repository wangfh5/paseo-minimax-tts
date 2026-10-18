import { useState } from "react";
import { Text,View,Pressable } from "react-native";
import type { PluginSurfaceProps } from "@getpaseo/plugin/client";
import { Icon } from "@getpaseo/plugin/client/react-native";
import * as player from "./web";
type Theme=PluginSurfaceProps["theme"];
export const clock=(s:number)=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`;
export function Button({theme,label,onPress,disabled=false,primary=false}:{theme:Theme;label:string;onPress:()=>void;disabled?:boolean;primary?:boolean}){
 const c=theme.colors;
 return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={{paddingVertical:8,paddingHorizontal:14,borderRadius:8,alignItems:"center",backgroundColor:primary?c.accent:c.surface2,opacity:disabled?0.5:1}}><Text style={{color:primary?c.accentForeground:c.foreground,fontWeight:"600"}}>{label}</Text></Pressable>;
}
export function IconButton({theme,icon,label,onPress,disabled=false}:{theme:Theme;icon:string;label:string;onPress:()=>void;disabled?:boolean}){
 return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={{width:24,height:24,borderRadius:12,alignItems:"center",justifyContent:"center",backgroundColor:theme.colors.accent,opacity:disabled?0.5:1}}><Icon name={icon} size={12} color={theme.colors.accentForeground}/></Pressable>;
}
export function Progress({theme,audio}:{theme:Theme;audio:ReturnType<typeof player.snapshot>}){
 const [width,setWidth]=useState(1);
 return <View accessibilityRole="adjustable" accessibilityLabel="Audio progress; drag to seek" accessibilityValue={{min:0,max:Math.round(audio.duration),now:Math.round(audio.position)}} onLayout={e=>setWidth(e.nativeEvent.layout.width)} onStartShouldSetResponder={()=>true} onMoveShouldSetResponder={()=>true} onResponderGrant={e=>player.seek(e.nativeEvent.locationX/width)} onResponderMove={e=>player.seek(e.nativeEvent.locationX/width)} style={{flex:1,height:28,justifyContent:"center"}}><View pointerEvents="none" style={{height:6,borderRadius:3,backgroundColor:theme.colors.surface2,overflow:"hidden"}}><View style={{height:6,width:`${audio.duration?100*audio.position/audio.duration:0}%`,backgroundColor:theme.colors.accent}}/></View></View>;
}
