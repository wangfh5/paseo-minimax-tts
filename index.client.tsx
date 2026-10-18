import type { PluginClientContext } from "@getpaseo/plugin/client";
import { Screen } from "./client/screen";
import { SpeechRow } from "./client/row";
import { startAutoplay } from "./client/auto";
import { speechKind,speechRow } from "./shared/tts";
import { dispose } from "./client/web";
export default function contribute(client:PluginClientContext){
 client.addSettingsScreen({id:"minimax-settings",title:"Settings",icon:"Volume2",Component:Screen});
 client.addCommandCenterItem({id:"settings",title:"MiniMax speech settings",icon:"Volume2",keywords:["tts","voice","speech"],context:"global",onSelect:({openSettings})=>openSettings("minimax-settings")});
 client.addTimelineRenderer({kind:speechKind,version:1,schema:speechRow,Component:props=><SpeechRow {...props} rpc={client.rpc}/>});
 const stop=startAutoplay(client.rpc);
 return ()=>{stop();dispose();};
}
