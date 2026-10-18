import { useEffect,useRef,useState,useSyncExternalStore } from "react";
import { useRpc,type PluginSurfaceProps } from "@getpaseo/plugin/client";
import { useQuery,useMutation } from "@tanstack/react-query";
import { Text,View,ScrollView,Pressable,TextInput,Switch } from "react-native";
import { getSettings,saveSettings,listReplies,synthesize,cancel,defaults } from "../shared/tts";
import * as player from "./web";
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
 const [form,setForm]=useState<{model:string;voice:string;region:"cn"|"global";alwaysOn:boolean}>(defaults),[key,setKey]=useState(""),[status,setStatus]=useState(""),[width,setWidth]=useState(1);
 const audio=useSyncExternalStore(player.subscribe,player.snapshot);
 useEffect(()=>{if(query.data){const {hasKey,...rest}=query.data;setForm(rest);}},[query.data]);
 const saving=useMutation({mutationFn:()=>save({...form,apiKey:key}),onSuccess:()=>{setKey("");setStatus("Saved securely on daemon");void query.refetch();},onError:e=>setStatus(e.message)});
 const speaking=useMutation({mutationFn:async(id:string)=>{const audio=await render({id});await player.play(audio.base64);},onError:e=>setStatus(e.message)});
 const text={color:theme.colors.foreground};const button=(label:string,fn:()=>void,disabled=false)=><Pressable accessibilityRole="button" disabled={disabled} onPress={fn} style={{padding:12,backgroundColor:theme.colors.surface0,opacity:disabled?0.5:1,borderWidth:1,borderColor:theme.colors.foregroundMuted,borderRadius:8}}><Text style={text}>{label}</Text></Pressable>;
 return <ScrollView style={{flex:1,backgroundColor:theme.colors.surface0}} contentContainerStyle={{padding:layout.compact?16:24,gap:12}}>
 <Text style={{...text,fontSize:22}}>MiniMax final-reply speech</Text>
 <Text style={text}>Desktop/web: play, pause and drag to seek. Native iOS/Android playback is not enabled: the public SDK has no seek API.</Text>
 {button(audio.playing?"Pause":"Resume",()=>{void player.toggle().catch(()=>setStatus("Playback failed"));})}
 <View accessibilityRole="adjustable" accessibilityLabel="Audio progress; drag to seek" accessibilityValue={{min:0,max:Math.round(audio.duration),now:Math.round(audio.position)}} onLayout={e=>setWidth(e.nativeEvent.layout.width)} onStartShouldSetResponder={()=>true} onMoveShouldSetResponder={()=>true} onResponderGrant={e=>player.seek(e.nativeEvent.locationX/width)} onResponderMove={e=>player.seek(e.nativeEvent.locationX/width)} style={{height:32,justifyContent:"center",backgroundColor:theme.colors.foregroundMuted,borderRadius:6}}><View pointerEvents="none" style={{height:12,width:`${audio.duration?100*audio.position/audio.duration:0}%`,backgroundColor:theme.colors.accent}}/></View>
 <Text style={text}>{Math.floor(audio.position)} / {Math.floor(audio.duration)} seconds</Text>
 {button("Stop playback / cancel synthesis",()=>{player.dispose();void abort({});})}
 <Text style={text}>{status || audio.error || query.error?.message || replies.error?.message}</Text>
 <Text style={{...text,fontSize:18}}>Settings</Text>
 <Text style={text}>API key: {query.data?.hasKey?"saved (never returned)":"not configured"}. Leave blank to retain.</Text>
 <TextInput accessibilityLabel="MiniMax API key" secureTextEntry autoCapitalize="none" autoCorrect={false} value={key} onChangeText={setKey} placeholder="Paste new API key" placeholderTextColor={theme.colors.foregroundMuted} style={{...text,padding:12,borderWidth:1,borderColor:theme.colors.foregroundMuted}}/>
 {(["model","voice"] as const).map(field=><View key={field}><Text style={text}>{field==="model"?"Model":"Voice ID"}</Text><TextInput accessibilityLabel={field} value={form[field]} onChangeText={value=>setForm({...form,[field]:value})} style={{...text,padding:12,borderWidth:1,borderColor:theme.colors.foregroundMuted}}/></View>)}
 {button(`Region: ${form.region} (tap to switch)`,()=>setForm({...form,region:form.region==="cn"?"global":"cn"}))}
 <View style={{flexDirection:"row",alignItems:"center",gap:12}}><Switch accessibilityLabel="Always On" value={form.alwaysOn} onValueChange={alwaysOn=>setForm({...form,alwaysOn})}/><Text style={text}>Always On (new replies only; incurs MiniMax charges)</Text></View>
 {button(saving.isPending?"Saving…":"Save settings",()=>saving.mutate(),saving.isPending)}
 {button("Delete saved key",()=>{void save({...form,clearKey:true}).then(()=>{setKey("");void query.refetch();}).catch(e=>setStatus(e.message));})}
 <Text style={text}>Always On runs while the plugin sidebar is mounted. Browser autoplay may require Resume. Only the newest reply per poll plays; reconnect never reads old replies aloud.</Text>
 <Text style={{...text,fontSize:18}}>Completed replies (latest 20, since plugin start)</Text>
 {!replies.data?.items.length&&<Text style={text}>Complete a new agent turn to see a Play button. No old history is synthesized.</Text>}
 {replies.data?.items.map(reply=><View key={reply.id} style={{gap:8}}><Text style={text}>{reply.title}</Text><Text numberOfLines={3} style={text}>{reply.text}</Text>{button(speaking.isPending?"Synthesizing…":"Play final reply",()=>speaking.mutate(reply.id),speaking.isPending||!player.supported())}</View>)}
 </ScrollView>;
}
