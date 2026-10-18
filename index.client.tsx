import type { PluginClientContext,PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { Screen,AutoPlayer } from "./client/screen";
import { dispose } from "./client/web";
function Item({currentScreen,openScreen}:PluginSidebarItemProps){return <><AutoPlayer/><SidebarRow icon="Volume2" active={currentScreen?.screenId==="minimax"} onPress={()=>openScreen({screenId:"minimax"})}/></>;}
export default function contribute(client:PluginClientContext){
 client.addScreen({id:"minimax",title:"MiniMax speech",Component:Screen});
 client.addSettingsScreen({id:"minimax-settings",title:"MiniMax speech",icon:"Volume2",Component:Screen});
 client.addSidebarFooterItem({id:"minimax",title:"MiniMax speech",Component:Item});
 return ()=>dispose();
}
