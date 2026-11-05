// Local Windows/MySQL equivalents of the legacy Supabase RPC adapter.
// Authenticated requests use only the current browser session; no service credentials.
const BASE=(import.meta.env.VITE_ECLIPSE_API_URL||'').replace(/\/+$/,'');
export async function localRequest(path,{method='GET',body}={}){
 const token=sessionStorage.getItem('eclipse-order-local-session');
 if(!token)throw new Error('Sign in to your Eclipse Order account.');
 const response=await fetch(BASE+path,{
  method,headers:{Authorization:'Bearer '+token,...(body!==undefined?{'Content-Type':'application/json'}:{})},
  ...(body!==undefined?{body:JSON.stringify(body)}:{}),cache:'no-store'
 });
 const data=response.status===204?{}:await response.json().catch(()=>null);
 if(!response.ok)throw new Error(data?.error||'Request failed ('+response.status+')');
 return data;
}
const get=p=>localRequest(p);
const post=(p,b={})=>localRequest(p,{method:'POST',body:b});
const put=(p,b)=>localRequest(p,{method:'PUT',body:b});
const del=p=>localRequest(p,{method:'DELETE'});
export const listStatusRequests=()=>get('/transitions');
export const requestCharacterStatus=(characterId,bound)=>post('/transitions',{character_id:characterId,bound});
export const decideCharacterStatus=(id,approve)=>post('/transitions/'+id+'/decide',{approve});
export const cancelCharacterStatus=id=>post('/transitions/'+id+'/cancel');
export const applyCharacterStatus=id=>post('/transitions/'+id+'/apply');
export const getMyPreferences=()=>get('/profile/preferences');
export const saveMyPreferences=(adult,preferences)=>put('/profile/preferences',{adult_declaration:Boolean(adult),content_preferences:preferences});
export const getMyKinkProfile=()=>get('/profile/rp');
export const saveMyKinkProfile=(displayName,shareContent,shareKinks,entries)=>put('/profile/rp',{
 display_name:displayName,share_content:shareContent,share_kinks:shareKinks,kink_entries:entries
});
export const listSharedRPProfiles=()=>get('/profile/directory');
export const readFCSettings=()=>get('/settings');
export const writeFCSetting=(key,content)=>put('/settings',{key,content});
export const listEncounters=()=>get('/encounters');
export const createEncounter=(name,notes,themes)=>post('/encounters',{name,notes,themes});
export const editPlannedEvent=(id,b)=>post('/encounters/'+id+'/plan',b);
export const addCombatant=(id,name,kind,characterId,initiative,hp,ac)=>post('/combatants',{
 encounter_id:id,name,kind,character_id:characterId,initiative,hp,ac
});
export const editCombatant=(id,hp,initiative,ac,conditions)=>post('/combatants/'+id,{hp,initiative,ac,conditions});
export const deleteCombatant=id=>del('/combatants/'+id);
export const encounterTurn=(id,action)=>post('/encounters/'+id+'/turn',{action});
export const encounterCheck=id=>get('/encounters/'+id+'/check');
export const pauseEncounter=(id,paused)=>post('/encounters/'+id+'/pause',{paused});
export const encounterRoll=(id,formula,visibility)=>post('/encounters/'+id+'/rolls',{formula,visibility});
export const encounterRolls=id=>get('/encounters/'+id+'/rolls');
export const listMonsterTemplates=()=>get('/monsters');
export const createMonsterTemplate=monster=>post('/monsters',monster);
export const addMonsterToEncounter=(id,monsterId)=>post('/encounters/'+id+'/monsters/'+monsterId);
export const rollAllInitiative=id=>post('/encounters/'+id+'/initiative');
export const setEncounterMap=(id,columns,rows,style)=>post('/encounters/'+id+'/map',{columns,rows,style});
export const moveEncounterToken=(id,x,y)=>post('/combatants/'+id+'/move',{x,y});
export const setEncounterMapImage=(id,imageUrl)=>post('/encounters/'+id+'/image',{image_url:imageUrl});
export const listGMRequests=id=>get('/encounters/'+id+'/roll-requests');
export const requestGMRoll=(id,characterId,kind,label,formula,dc)=>post('/encounters/'+id+'/roll-requests',{
 character_id:characterId,kind,label,formula,dc
});
export const resolveGMRoll=id=>post('/roll-requests/'+id+'/resolve');
export const cancelGMRoll=id=>post('/roll-requests/'+id+'/cancel');
export const adjustCombatantHP=(id,delta)=>post('/combatants/'+id+'/hp',{delta});
export const rollEncounterAction=(id,formula,visibility,kind,target,dc)=>post('/encounters/'+id+'/rolls',{
 formula,visibility,kind,target_id:target,target_dc:dc
});
export const applyRolledHP=(id,target)=>post('/rolls/'+id+'/apply-hp',{combatant_id:target});
export const signupForEvent=(id,characterId)=>post('/events/'+id+'/signups',{character_id:characterId});
export const listEventSignups=id=>get('/events/'+id+'/signups');
export const decideEventSignup=(id,approved)=>post('/signups/'+id+'/decide',{approved});
export const withdrawEventSignup=id=>post('/signups/'+id+'/withdraw');
export const addApprovedEventPlayer=id=>post('/signups/'+id+'/add-player');
export const setAdultRPAccess=()=>{throw new Error('This older approval action is unavailable. Use your RP profile to manage the 18+ declaration.');};

export const listEventXpAwards=id=>get('/events/'+id+'/xp');
export const awardEventXp=(eventId,characterId,amount)=>post('/events/'+eventId+'/xp/'+characterId,{amount});
