import { useEffect,useRef,useState,useSyncExternalStore } from "react";
import { useRpc,type PluginSurfaceProps } from "@getpaseo/plugin/client";
import { useQuery,useMutation } from "@tanstack/react-query";
import { Text,View,ScrollView,Pressable,TextInput,Switch,type TextStyle,type ViewStyle } from "react-native";
import { getSettings,saveSettings,listReplies,synthesize,cancel,defaults } from "../shared/tts";
import * as player from "./web";
const clock=(s:number)=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`;
// Mounted in the sidebar: autoplay observes new live rows, never the initial snapshot.
export function AutoPlayer(){
 const list=useRpc(listReplies),settings=useRpc(getSettings),render=useRpc(synthesize);
 const seen=useRef<Set<string>|null>(null);
 useEffect(()=>{let stopped=false,busy=false;const poll=async()=>{if(busy)return;busy=true;try{const [data,config]=await Promise.all([list({}),settings({})]);if(stopped)return;const fresh=data.items.filter(x=>seen.current&&!seen.current.has(x.id));seen.current=new Set(data.items.map(x=>x.id));if(config.alwaysOn&&player.supported()&&fresh[0]){const audio=await render({id:fresh[0].id});if(!stopped)await player.play(audio.base64);}}catch{seen.current=null;}finally{busy=false;}};void poll();const timer=setInterval(()=>void poll(),3000);return()=>{stopped=true;clearInterval(timer);};},[list,settings,render]);return null;
}
export function Screen({theme,layout}:PluginSurfaceProps){
 const get=useRpc(getSettings),save=useRpc(saveSettings),list=useRpc(listReplies),render=useRpc(synthesize),abort=useRpc(cancel);
 const query=useQuery({queryKey:["minimax-settings"],queryFn:()=>get({})});
 const replies=useQuery({queryKey:["minimax-replies"],queryFn:()=>list({}),refetchInterval:3000});
 const [form,setForm]=useState<{model:string;voice:string;region:"cn"|"global";alwaysOn:boolean}>(defaults),[key,setKey]=useState(""),[status,setStatus]=useState(""),[width,setWidth]=useState(1),[advanced,setAdvanced]=useState(false);
 const audio=useSyncExternalStore(player.subscribe,player.snapshot);
 useEffect(()=>{if(query.data){const {hasKey,...rest}=query.data;setForm(rest);}},[query.data]);
 const saving=useMutation({mutationFn:()=>save({...form,apiKey:key}),onSuccess:()=>{setKey("");setStatus("");void query.refetch();},onError:e=>setStatus(e.message)});
 const speaking=useMutation({mutationFn:async(id:string)=>{const audio=await render({id});await player.play(audio.base64);},onError:e=>setStatus(e.message)});
 const c=theme.colors,saved=query.data;
 const dirty=!!saved&&(!!key||(["model","voice","region","alwaysOn"] as const).some(k=>form[k]!==saved[k]));
 const error=status||audio.error||query.error?.message||replies.error?.message;
 const text:TextStyle={color:c.foreground},muted:TextStyle={color:c.foregroundMuted,fontSize:13},heading:TextStyle={...text,fontSize:16,fontWeight:"600"};
 const card:ViewStyle={backgroundColor:c.surface1,borderWidth:1,borderColor:c.border,borderRadius:12,padding:16,gap:14};
 const input:TextStyle={...text,padding:10,borderWidth:1,borderColor:c.border,borderRadius:8,backgroundColor:c.surface0};
 const button=(label:string,fn:()=>void,disabled=false,primary=false)=><Pressable accessibilityRole="button" disabled={disabled} onPress={fn} style={{paddingVertical:8,paddingHorizontal:14,borderRadius:8,alignItems:"center",backgroundColor:primary?c.accent:c.surface2,opacity:disabled?0.5:1}}><Text style={{color:primary?c.accentForeground:c.foreground,fontWeight:"600"}}>{label}</Text></Pressable>;
 const field=(label:string,child:React.ReactNode,aside?:React.ReactNode)=><View style={{gap:6}}><View style={{flexDirection:"row",justifyContent:"space-between"}}><Text style={{...text,fontWeight:"500"}}>{label}</Text>{aside}</View>{child}</View>;
 return <ScrollView style={{flex:1,backgroundColor:c.surface0}} contentContainerStyle={{padding:layout.compact?16:24}}>
 <View style={{width:"100%",maxWidth:640,alignSelf:"center",gap:20}}>
 <View style={{gap:4}}>
  <Text style={{...text,fontSize:22,fontWeight:"600"}}>MiniMax speech</Text>
  <Text style={muted}>Reads the final reply of each agent turn aloud.</Text>
 </View>
 <View style={card}>
  <View style={{flexDirection:"row",alignItems:"center",gap:12}}>
   {button(audio.playing?"Pause":"Play",()=>{void player.toggle().catch(()=>setStatus("Playback failed"));},!audio.duration,true)}
   <View accessibilityRole="adjustable" accessibilityLabel="Audio progress; drag to seek" accessibilityValue={{min:0,max:Math.round(audio.duration),now:Math.round(audio.position)}} onLayout={e=>setWidth(e.nativeEvent.layout.width)} onStartShouldSetResponder={()=>true} onMoveShouldSetResponder={()=>true} onResponderGrant={e=>player.seek(e.nativeEvent.locationX/width)} onResponderMove={e=>player.seek(e.nativeEvent.locationX/width)} style={{flex:1,height:28,justifyContent:"center"}}><View pointerEvents="none" style={{height:6,borderRadius:3,backgroundColor:c.surface2,overflow:"hidden"}}><View style={{height:6,width:`${audio.duration?100*audio.position/audio.duration:0}%`,backgroundColor:c.accent}}/></View></View>
   <Text style={muted}>{clock(audio.position)} / {clock(audio.duration)}</Text>
   {button("Stop",()=>{player.dispose();void abort({});})}
  </View>
  {!player.supported()&&<Text style={muted}>Playback is available on desktop and web only.</Text>}
  {!!error&&<Text style={{color:c.statusDanger,fontSize:13}}>{error}</Text>}
 </View>
 <View style={{gap:8}}>
  <Text style={heading}>Settings</Text>
  <View style={card}>
   {field("API key",<TextInput accessibilityLabel="MiniMax API key" secureTextEntry autoCapitalize="none" autoCorrect={false} value={key} onChangeText={setKey} placeholder={saved?.hasKey?"Saved — paste a new key to replace it":"Paste your MiniMax API key"} placeholderTextColor={c.foregroundMuted} style={input}/>,saved?.hasKey&&<Pressable accessibilityRole="button" onPress={()=>{void save({...form,clearKey:true}).then(()=>{setKey("");void query.refetch();}).catch(e=>setStatus(e.message));}}><Text style={{color:c.statusDanger,fontSize:13}}>Remove saved key</Text></Pressable>)}
   <View style={{flexDirection:"row",alignItems:"center",gap:12}}>
    <View style={{flex:1}}><Text style={{...text,fontWeight:"500"}}>Always On</Text><Text style={muted}>Read new replies automatically. Incurs MiniMax charges.</Text></View>
    <Switch accessibilityLabel="Always On" value={form.alwaysOn} onValueChange={alwaysOn=>setForm({...form,alwaysOn})} trackColor={{true:c.accent,false:c.border}}/>
   </View>
   <Pressable accessibilityRole="button" accessibilityState={{expanded:advanced}} onPress={()=>setAdvanced(!advanced)} style={{gap:2}}>
    <Text style={{...text,fontWeight:"500"}}>{advanced?"▾":"▸"} Advanced</Text>
    {!advanced&&<Text numberOfLines={1} style={muted}>{form.region==="cn"?"China":"Global"} · {form.model} · {form.voice}</Text>}
   </Pressable>
   {advanced&&<>
    {field("Region",<View style={{flexDirection:"row",backgroundColor:c.surface2,borderRadius:8,padding:2}}>{(["cn","global"] as const).map(region=><Pressable key={region} accessibilityRole="button" accessibilityState={{selected:form.region===region}} onPress={()=>setForm({...form,region})} style={{flex:1,alignItems:"center",padding:6,borderRadius:6,backgroundColor:form.region===region?c.surface0:"transparent"}}><Text style={text}>{region==="cn"?"China":"Global"}</Text></Pressable>)}</View>)}
    {(["model","voice"] as const).map(name=><View key={name}>{field(name==="model"?"Model":"Voice ID",<TextInput accessibilityLabel={name} autoCapitalize="none" autoCorrect={false} value={form[name]} onChangeText={value=>setForm({...form,[name]:value})} style={input}/>)}</View>)}
   </>}
   <View style={{flexDirection:"row",alignItems:"center",justifyContent:"flex-end",gap:12}}>
    {saving.isSuccess&&!dirty&&<Text style={{color:c.statusSuccess,fontSize:13}}>Saved</Text>}
    {button(saving.isPending?"Saving…":"Save",()=>saving.mutate(),!dirty||saving.isPending,true)}
   </View>
  </View>
 </View>
 <View style={{gap:8}}>
  <View style={{flexDirection:"row",alignItems:"baseline",justifyContent:"space-between"}}><Text style={heading}>Recent replies</Text><Text style={muted}>Latest 20 since plugin start</Text></View>
  <View style={{...card,gap:0,paddingVertical:4}}>
   {!replies.data?.items.length&&<Text style={{...muted,paddingVertical:12}}>Complete a new agent turn and it will appear here.</Text>}
   {replies.data?.items.map((reply,i)=><View key={reply.id} style={{flexDirection:"row",alignItems:"center",gap:12,paddingVertical:12,borderTopWidth:i?1:0,borderTopColor:c.border}}>
    <View style={{flex:1,gap:2}}><Text numberOfLines={1} style={muted}>{reply.title} · {new Date(reply.createdAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</Text><Text numberOfLines={2} style={text}>{reply.text}</Text></View>
    {button(speaking.isPending&&speaking.variables===reply.id?"Synthesizing…":"Play",()=>speaking.mutate(reply.id),speaking.isPending||!player.supported())}
   </View>)}
  </View>
 </View>
 </View>
 </ScrollView>;
}
