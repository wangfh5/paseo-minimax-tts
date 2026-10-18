import { useEffect,useState } from "react";
import { useRpc,type PluginSurfaceProps } from "@getpaseo/plugin/client";
import { useQuery,useMutation } from "@tanstack/react-query";
import { Text,View,ScrollView,Pressable,TextInput,type TextStyle,type ViewStyle } from "react-native";
import { getSettings,saveSettings,getCacheStats,clearCache,defaults,modeOptions,type Mode } from "../shared/tts";
import { Button,Segmented } from "./controls";
const hints:Record<Mode,string>={off:"Speech is generated only when you press Play.",synthesize:"Generate speech for each new reply right away so Play is instant. Billed even if you never play it.",play:"Generate and play each new reply automatically. Incurs MiniMax charges."};
const megabytes=(bytes:number)=>`${(bytes/1048576).toFixed(bytes<10485760?1:0)} MB`;
const parseLimit=(text:string)=>/^\d+$/.test(text)&&Number(text)>=1&&Number(text)<=100000?Number(text):null;
export function Screen({theme,layout}:PluginSurfaceProps){
 const get=useRpc(getSettings),save=useRpc(saveSettings),getStats=useRpc(getCacheStats),clear=useRpc(clearCache);
 const query=useQuery({queryKey:["minimax-settings"],queryFn:()=>get({})});
 const stats=useQuery({queryKey:["minimax-cache"],queryFn:()=>getStats({})});
 const [form,setForm]=useState<{model:string;voice:string;region:"cn"|"global";auto:Mode;cacheMb:number}>(defaults),[limit,setLimit]=useState(String(defaults.cacheMb)),[confirming,setConfirming]=useState(false),[key,setKey]=useState(""),[status,setStatus]=useState(""),[advanced,setAdvanced]=useState(false);
 useEffect(()=>{if(query.data){const {hasKey,...rest}=query.data;setForm(rest);setLimit(String(rest.cacheMb));}},[query.data]);
 useEffect(()=>{if(!confirming)return;const timer=setTimeout(()=>setConfirming(false),4000);return()=>clearTimeout(timer);},[confirming]);
 const saving=useMutation({mutationFn:()=>save({...form,apiKey:key}),onSuccess:()=>{setKey("");setStatus("");void query.refetch();void stats.refetch();},onError:e=>setStatus(e.message)});
 const clearing=useMutation({mutationFn:()=>clear({}),onSuccess:()=>{setConfirming(false);void stats.refetch();},onError:e=>setStatus(e.message)});
 const c=theme.colors,saved=query.data;
 const dirty=!!saved&&(!!key||(["model","voice","region","auto","cacheMb"] as const).some(k=>form[k]!==saved[k]));
 const limitOk=parseLimit(limit)!==null;
 const error=status||query.error?.message;
 const text:TextStyle={color:c.foreground},muted:TextStyle={color:c.foregroundMuted,fontSize:13};
 const card:ViewStyle={backgroundColor:c.surface1,borderWidth:1,borderColor:c.border,borderRadius:12,padding:16,gap:14};
 const input:TextStyle={...text,padding:10,borderWidth:1,borderColor:c.border,borderRadius:8,backgroundColor:c.surface0};
 const button=(label:string,fn:()=>void,disabled=false,primary=false)=><Button theme={theme} label={label} onPress={fn} disabled={disabled} primary={primary}/>;
 const field=(label:string,child:React.ReactNode,aside?:React.ReactNode)=><View style={{gap:6}}><View style={{flexDirection:"row",justifyContent:"space-between"}}><Text style={{...text,fontWeight:"500"}}>{label}</Text>{aside}</View>{child}</View>;
 return <ScrollView style={{flex:1,backgroundColor:c.surface0}} contentContainerStyle={{padding:layout.compact?16:24}}>
 <View style={{width:"100%",maxWidth:640,alignSelf:"center",gap:20}}>
 <View style={{gap:4}}>
  <Text style={{...text,fontSize:22,fontWeight:"600"}}>MiniMax speech</Text>
  <Text style={muted}>Reads the final reply of each agent turn aloud.</Text>
 </View>
 <View style={card}>
  {field("API key",<TextInput accessibilityLabel="MiniMax API key" secureTextEntry autoCapitalize="none" autoCorrect={false} value={key} onChangeText={setKey} placeholder={saved?.hasKey?"Saved — paste a new key to replace it":"Paste your MiniMax API key"} placeholderTextColor={c.foregroundMuted} style={input}/>,saved?.hasKey&&<Pressable accessibilityRole="button" onPress={()=>{void save({...form,clearKey:true}).then(()=>{setKey("");void query.refetch();}).catch(e=>setStatus(e.message));}}><Text style={{color:c.statusDanger,fontSize:13}}>Remove saved key</Text></Pressable>)}
  {field("Automatic speech",<><Segmented theme={theme} value={form.auto} options={modeOptions} onChange={auto=>setForm({...form,auto})}/><Text style={muted}>{hints[form.auto]} Default for every chat; a chat can override it from its player row.</Text></>)}
  <Pressable accessibilityRole="button" accessibilityState={{expanded:advanced}} onPress={()=>setAdvanced(!advanced)} style={{gap:2}}>
   <Text style={{...text,fontWeight:"500"}}>{advanced?"▾":"▸"} Advanced</Text>
   {!advanced&&<Text numberOfLines={1} style={muted}>{form.region==="cn"?"China":"Global"} · {form.model} · {form.voice}</Text>}
  </Pressable>
  {advanced&&<>
   {field("Region",<Segmented theme={theme} value={form.region} options={[{label:"China",value:"cn"},{label:"Global",value:"global"}]} onChange={region=>setForm({...form,region})}/>)}
   {(["model","voice"] as const).map(name=><View key={name}>{field(name==="model"?"Model":"Voice ID",<TextInput accessibilityLabel={name} autoCapitalize="none" autoCorrect={false} value={form[name]} onChangeText={value=>setForm({...form,[name]:value})} style={input}/>)}</View>)}
  </>}
  {field("Audio cache",<>
   <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12}}>
    <Text style={muted}>{stats.data?`${stats.data.files} file${stats.data.files===1?"":"s"} · ${megabytes(stats.data.bytes)} used`:"…"}</Text>
    {button(clearing.isPending?"Clearing…":confirming?"Tap again to clear":"Clear cache",()=>{if(confirming)clearing.mutate();else setConfirming(true);},!stats.data?.files||clearing.isPending)}
   </View>
   <View style={{flexDirection:"row",alignItems:"center",gap:8}}>
    <Text style={muted}>Keep at most</Text>
    <TextInput accessibilityLabel="Maximum cache size in MB" keyboardType="number-pad" value={limit} onChangeText={value=>{setLimit(value);const parsed=parseLimit(value);if(parsed!==null)setForm({...form,cacheMb:parsed});}} style={{...input,width:90,paddingVertical:6}}/>
    <Text style={muted}>MB; least recently used audio goes first.</Text>
   </View>
   {!limitOk&&<Text style={{color:c.statusDanger,fontSize:13}}>Use a whole number from 1 to 100000.</Text>}
  </>)}
  {!!error&&<Text style={{color:c.statusDanger,fontSize:13}}>{error}</Text>}
  <View style={{flexDirection:"row",alignItems:"center",justifyContent:"flex-end",gap:12}}>
   {saving.isSuccess&&!dirty&&<Text style={{color:c.statusSuccess,fontSize:13}}>Saved</Text>}
   {button(saving.isPending?"Saving…":"Save",()=>saving.mutate(),!dirty||!limitOk||saving.isPending,true)}
  </View>
 </View>
 </View>
 </ScrollView>;
}
