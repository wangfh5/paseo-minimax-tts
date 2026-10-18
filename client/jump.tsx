import { useEffect } from "react";
import { Text,View } from "react-native";
import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { Button } from "./controls";
import { firstVisit } from "./visit";
// Sidebar items cannot navigate but screens can, so the now-playing row opens this helper screen, which opens the chat right away.
export function Jump({theme,layout,params,navigation}:PluginScreenProps){
 const open=()=>navigation?.openAgent({agentId:params.agentId});
 useEffect(()=>{if(firstVisit(params.at))open();},[params.at]);
 return <View style={{flex:1,backgroundColor:theme.colors.surface0,padding:layout.compact?16:24,gap:12,alignItems:"flex-start"}}>
  <Text style={{color:theme.colors.foregroundMuted}}>{navigation?"Opening the chat…":"This version of Paseo cannot open a chat from a plugin."}</Text>
  {!!navigation&&<Button theme={theme} label="Open chat" onPress={open}/>}
 </View>;
}
