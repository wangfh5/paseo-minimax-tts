import { useEffect,useState } from "react";
import { useRpc,type PluginSurfaceProps } from "@getpaseo/plugin/client";
import { useQuery,useMutation } from "@tanstack/react-query";
import { Text,View,ScrollView,Pressable,TextInput,Switch,type TextStyle,type ViewStyle } from "react-native";
import { getSettings,saveSettings,defaults } from "../shared/tts";
import { Button } from "./controls";
export function Screen({theme,layout}:PluginSurfaceProps){
 const get=useRpc(getSettings),save=useRpc(saveSettings);
 const query=useQuery({queryKey:["minimax-settings"],queryFn:()=>get({})});
 const [form,setForm]=useState<{model:string;voice:string;region:"cn"|"global";alwaysOn:boolean}>(defaults),[key,setKey]=useState(""),[status,setStatus]=useState(""),[advanced,setAdvanced]=useState(false);
 useEffect(()=>{if(query.data){const {hasKey,...rest}=query.data;setForm(rest);}},[query.data]);
 const saving=useMutation({mutationFn:()=>save({...form,apiKey:key}),onSuccess:()=>{setKey("");setStatus("");void query.refetch();},onError:e=>setStatus(e.message)});
 const c=theme.colors,saved=query.data;
 const dirty=!!saved&&(!!key||(["model","voice","region","alwaysOn"] as const).some(k=>form[k]!==saved[k]));
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
  {!!error&&<Text style={{color:c.statusDanger,fontSize:13}}>{error}</Text>}
  <View style={{flexDirection:"row",alignItems:"center",justifyContent:"flex-end",gap:12}}>
   {saving.isSuccess&&!dirty&&<Text style={{color:c.statusSuccess,fontSize:13}}>Saved</Text>}
   {button(saving.isPending?"Saving…":"Save",()=>saving.mutate(),!dirty||saving.isPending,true)}
  </View>
 </View>
 </View>
 </ScrollView>;
}
