// Supabase REST client. Only the public publishable/anon key is used in the browser.
// All data access is checked by Postgres row-level security.
const url = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
export const configured = Boolean(url && key);
const SESSION_KEY = 'eclipse-order-supabase-session';
const headers = (token, extra={}) => ({apikey:key,...(token ? {Authorization:'Bearer '+token} : {}),...extra});
async function parse(response) {
  const value=await response.json().catch(()=>null);
  if (!response.ok) throw new Error(value?.msg || value?.error_description || value?.message || 'Request failed ('+response.status+')');
  return value;
}
async function authRequest(path, body) {
  const response=await fetch(url+'/auth/v1/'+path,{method:'POST',headers:headers(null,{'Content-Type':'application/json'}),body:JSON.stringify(body)});
  return parse(response);
}
export async function signIn(email,password) {
  const result=await authRequest('token?grant_type=password',{email,password});
  sessionStorage.setItem(SESSION_KEY,JSON.stringify({...result,expires_at:Math.floor(Date.now()/1000)+(result.expires_in||3600)}));
  return result;
}
export function signOut() { sessionStorage.removeItem(SESSION_KEY); }
export function currentSession() { try {return JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');}catch{return null;} }
let refreshing=null;
async function accessToken() {
  const session=currentSession();
  if (!session?.access_token) throw new Error('Please sign in to access the shared ledger.');
  const expiry=(session.expires_at || (session.expires_in ? Math.floor(Date.now()/1000)+session.expires_in : 0));
  if (expiry && expiry>Date.now()/1000+60) return session.access_token;
  if (!session.refresh_token) throw new Error('Your session expired. Sign in again.');
  if (!refreshing) refreshing=authRequest('token?grant_type=refresh_token',{refresh_token:session.refresh_token}).then(next=>{
    sessionStorage.setItem(SESSION_KEY,JSON.stringify({...next,expires_at:Math.floor(Date.now()/1000)+(next.expires_in||3600)}));
    return next.access_token;
  }).finally(()=>{refreshing=null;});
  return refreshing;
}
export async function sharedRequest(path, options={}) {
  if (!configured) throw new Error('Supabase environment variables have not been configured.');
  const token=await accessToken();
  const response=await fetch(url+'/rest/v1/'+path,{...options,headers:headers(token,{'Content-Type':'application/json',...options.headers})});
  return parse(response);
}
// Only RPC functions are available to browser clients. The raw characters
// table is deliberately inaccessible to authenticated users.
async function rpc(name,args={}) {
  return sharedRequest('rpc/'+name,{method:'POST',body:JSON.stringify(args)});
}
export async function loadMyRole(){
  return rpc('order_my_role');
}
export async function loadSharedCharacters(){
  return rpc('order_list_characters');
}
export async function saveSharedCharacter(character){
  return rpc('order_save_character',{payload:character});
}
export async function removeSharedCharacter(id){
  return rpc('order_delete_character',{record_id:String(id)});
}
export async function importSharedCharacters(characters){
  for (const character of characters) await saveSharedCharacter(character);
}
export async function loadOrderMembers(){
  return rpc('order_list_members');
}
export async function updateOrderMemberRole(userId,role){
  return rpc('order_set_member_role',{target_user_id:userId,target_role:role});
}

export async function updateOrderMemberStanding(userId,standing){
  return rpc('order_set_member_standing',{target_user_id:userId,new_standing:standing});
}

// Roleplay platform RPCs. Status transitions require explicit player approval.
export const listStatusRequests = () => rpc('order_list_status_requests');
export const requestCharacterStatus = (characterId,bound) => rpc('order_request_status',{p_character_id:String(characterId),p_bound:bound});
export const decideCharacterStatus = (id,approve) => rpc('order_decide_status',{p_request_id:id,p_approve:approve});
export const cancelCharacterStatus = id => rpc('order_cancel_status',{p_request_id:id});
export const applyCharacterStatus = id => rpc('order_apply_status',{p_request_id:id});
export const listScenes = () => rpc('order_list_scenes');
export const createScene = (title,summary,themes) => rpc('order_create_scene',{p_title:title,p_summary:summary,p_themes:themes});
export const setSceneConsent = (id,consent,paused) => rpc('order_scene_consent',{p_scene_id:id,p_consent:consent,p_paused:paused});
export const setSceneState = (id,state) => rpc('order_scene_state',{p_scene_id:id,p_state:state});
export const rollSceneDice = (id,count,sides,modifier) => rpc('order_roll_dice',{p_scene_id:id,p_count:count,p_sides:sides,p_modifier:modifier});
export const listSceneRolls = id => rpc('order_list_dice',{p_scene_id:id});

export const setAdultRPAccess = (id,approved) => rpc('order_set_adult_approved',{p_user_id:id,p_approved:approved});

export const rollDiceExpression = (sceneId,expression,visibility='public') => rpc('order_roll_expression',{p_scene_id:sceneId,p_expression:expression,p_visibility:visibility});

export const readFCSettings = () => rpc('order_read_settings');
export const writeFCSetting = (key,content) => rpc('order_write_setting',{p_key:key,p_content:content});

export const getMyPreferences=()=>rpc('order_get_my_preferences');
export const saveMyPreferences=(adult,preferences)=>rpc('order_save_my_preferences',{p_adult:adult,p_preferences:preferences});
export const listEncounters=()=>rpc('order_list_encounters');
export const createEncounter=(name,notes,themes)=>rpc('order_create_encounter',{p_name:name,p_notes:notes,p_themes:themes});
export const addCombatant=(encounterId,name,kind,characterId,initiative,hp,ac)=>rpc('order_add_combatant',{p_encounter:encounterId,p_name:name,p_kind:kind,p_character:characterId||null,p_initiative:initiative,p_hp:hp,p_ac:ac});
export const editCombatant=(id,hp,initiative,ac,conditions)=>rpc('order_edit_combatant',{p_id:id,p_hp:hp,p_initiative:initiative,p_ac:ac,p_conditions:conditions});
export const deleteCombatant=id=>rpc('order_delete_combatant',{p_id:id});
export const encounterTurn=(id,action)=>rpc('order_encounter_turn',{p_encounter:id,p_action:action});
export const encounterCheck=id=>rpc('order_my_encounter_check',{p_encounter:id});
export const pauseEncounter=(id,paused)=>rpc('order_set_my_encounter_pause',{p_encounter:id,p_paused:paused});
export const encounterRoll=(id,formula,visibility)=>rpc('order_roll_encounter',{p_encounter:id,p_formula:formula,p_visibility:visibility});
export const encounterRolls=id=>rpc('order_list_encounter_rolls',{p_encounter:id});

export const listMonsterTemplates=()=>rpc('order_list_monster_templates');
export const createMonsterTemplate=(monster)=>rpc('order_create_monster_template',{
 p_name:monster.name,p_challenge:monster.challenge,p_hp:Number(monster.hit_points),
 p_ac:Number(monster.armor_class),p_init_bonus:Number(monster.initiative_bonus),
 p_actions:monster.actions||'',p_notes:monster.notes||''
});
export const addMonsterToEncounter=(encounterId,monsterId)=>rpc('order_add_monster_to_encounter',{p_encounter:encounterId,p_monster:monsterId});
export const rollAllInitiative=encounterId=>rpc('order_roll_all_initiative',{p_encounter:encounterId});

export const setEncounterMap=(id,columns,rows,style)=>rpc('order_set_encounter_map',{p_encounter:id,p_columns:columns,p_rows:rows,p_style:style});
export const moveEncounterToken=(id,x,y)=>rpc('order_move_token',{p_combatant:id,p_x:x,p_y:y});

export const listGMRequests=encounterId=>rpc('order_list_roll_requests',{p_encounter:encounterId});
export const requestGMRoll=(encounterId,characterId,kind,label,formula,dc)=>rpc('order_request_dice',{p_encounter:encounterId,p_character:characterId,p_kind:kind,p_label:label,p_formula:formula,p_dc:dc});
export const resolveGMRoll=id=>rpc('order_resolve_dice_request',{p_request:id});
export const cancelGMRoll=id=>rpc('order_cancel_dice_request',{p_request:id});
export const adjustCombatantHP=(id,delta)=>rpc('order_adjust_combatant_hp',{p_combatant:id,p_delta:delta});

export const rollEncounterAction=(encounterId,formula,visibility,kind,target,dc)=>rpc('order_roll_action',{
 p_encounter:encounterId,p_formula:formula,p_visibility:visibility,p_kind:kind,
 p_target:target||null,p_dc:dc===null||dc===undefined||dc===''?null:Number(dc)
});

export const applyRolledHP=(rollId,targetId)=>rpc('order_apply_roll_hp',{p_roll_id:rollId,p_target:targetId});

export const setEncounterMapImage=(id,imageUrl)=>rpc('order_set_encounter_map_image',{p_encounter:id,p_image_url:imageUrl});
