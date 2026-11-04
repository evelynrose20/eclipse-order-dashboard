// Supabase REST client. Only the public publishable/anon key is used in the browser.
// All data access is checked by Postgres row-level security.
const url = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
export const configured = Boolean(url && key);
const SESSION_KEY = 'eclipse-order-supabase-session';
const headers = (token, extra={}) => ({apikey:key,Authorization:'Bearer '+(token||key),...extra});
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
export async function loadSharedCharacters() {
  const records=await sharedRequest('characters?select=id,data&order=updated_at.desc');
  return records.map(row=>({...row.data,id:row.id}));
}
export async function saveSharedCharacter(character) {
  await sharedRequest('characters?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([{id:character.id,data:character}])});
}
export async function removeSharedCharacter(id) {
  await sharedRequest('characters?id=eq.'+encodeURIComponent(id),{method:'DELETE',headers:{Prefer:'return=minimal'}});
}
export async function importSharedCharacters(characters) {
  for(let offset=0;offset<characters.length;offset+=100) {
    await sharedRequest('characters?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(characters.slice(offset,offset+100).map(c=>({id:c.id,data:c})))});
  }
}
