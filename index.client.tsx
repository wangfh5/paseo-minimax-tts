import type { PluginClientContext } from "@getpaseo/plugin/client";
import { Screen } from "./client/screen";
import { SpeechRow } from "./client/row";
import { NowPlaying } from "./client/nowplaying";
import { Jump } from "./client/jump";
import { startAutoplay } from "./client/auto";
import { stopWhenChatGone } from "./client/chats";
import { speechKind,speechRow } from "./shared/tts";
import { registerWhile } from "./client/registration";
import * as player from "./client/web";
export default function contribute(client:PluginClientContext){
 client.addSettingsScreen({id:"minimax-settings",title:"Settings",icon:"Volume2",Component:Screen});
 client.addScreen({id:"jump",title:"Opening chat",Component:Jump});
 client.addCommandCenterItem({id:"settings",title:"MiniMax speech settings",icon:"Volume2",keywords:["tts","voice","speech"],context:"global",onSelect:({openSettings})=>openSettings("minimax-settings")});
 client.addTimelineRenderer({kind:speechKind,version:1,schema:speechRow,Component:props=><SpeechRow {...props} rpc={client.rpc}/>});
 // Registered only while audio is loaded and unfinished; otherwise the sidebar would keep an empty strip.
 const hideNowPlaying=registerWhile(()=>{const now=player.snapshot();return !!now.id&&!now.ended;},()=>client.addSidebarFooterItem({id:"now-playing",title:"Now reading",Component:NowPlaying}),player.subscribe);
 const stop=startAutoplay(client.rpc),unwatch=stopWhenChatGone(client);
 return ()=>{stop();unwatch();hideNowPlaying();player.dispose();};
}
