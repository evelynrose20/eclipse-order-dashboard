import React,{useEffect,useRef,useState} from 'react';
import './local-accounts.css';
import './imperial-theme.css';
import OrderEmblem from './OrderEmblem.jsx';
import LocalWorkspace from './LocalWorkspace.jsx';
import DiscordAccessPage from './DiscordAccessPage.jsx';

const API=(import.meta.env.VITE_ECLIPSE_API_URL||'').replace(/\/+$/,'');
const storageKey='eclipse-order-local-session';
const ERROR_MESSAGES={
 chair_must_be_offline:'The apparatus must be Offline before a character can be seated.',
 chair_occupied:'The chamber chair is already occupied. Release the current character first.',
 chair_empty:'The chamber chair is empty.',
 character_has_not_opted_in:'This character has not enabled seating and collection permissions in their dossier.',
 character_contribution_limit:'This record exceeds the character\'s permitted category or per-seating limit.',
 assembly_not_active:'An occupied chair and active assembly are required to record a collection.',
 character_owner_required:'Only the character\'s player may change these permissions.',
 chamber_not_initialized:'Run the Windows API database setup to initialize the chamber.',

 discord_login_not_configured:'Discord sign-in has not been configured yet. Contact Order command.',
 discord_not_in_server:'Your Discord account was not found in the Order’s configured server. If you are already a member, contact Order command to check the server connection.',
 discord_membership_screening:'Finish the Discord server’s membership screening, then sign in again.',
 discord_server_check_unavailable:'The Order could not verify Discord membership. Please try again later.',
 discord_guild_configuration_error:'The Order’s Discord server connection is misconfigured. This is not proof you left the server.',
 discord_join_denied:'Discord server access was not authorized. You can try again or contact Order command.',
 discord_denied:'Discord authorization was cancelled.',
 discord_expired_request:'Your Discord sign-in expired. Please try again.',
 discord_invalid_callback:'Discord did not return a valid authorization. Try again.',
 discord_ticket_expired:'Your Discord sign-in expired. Please try again.',
 discord_identity_taken:'This Discord account is already linked to another Order account.',
 discord_account_conflict:'There is an issue with this Discord account. Please contact Order command.',
 discord_unavailable:'Discord could not verify your identity right now. Try again later.',
 discord_only_login:'Please sign in using Discord.',
 discord_only_registration:'Membership requests begin with Discord.',
 account_not_approved:'The Order has not approved your membership.',
 recruitment_closed:'The Order is not accepting new membership applications at present.',
 too_many_attempts:'Too many attempts. Try again later.',
 rail_route_invalid_fields:'Check both station selections, the service name and the journey duration.',
 rail_route_order_stops_only:'Internal trains may serve Order-controlled settlements and active Order fronts only.',
 rail_route_station_not_found:'Choose two saved internal railway stations.',
 rail_route_distinct_stations_required:'The origin and destination must be stations at different locations.',
 rail_station_invalid_fields:'Enter a station name, select an Order location and choose a platform count from 1 to 100.',
 rail_station_order_stop_required:'Choose an Order-controlled settlement or an active Order front.',
 rail_station_has_routes:'This station is used by a rail service. Retire or update those services before deleting it.',
 rail_station_has_active_journey:'A train is currently travelling to or from this station.',
 rail_stations_not_operational:'Both stations must be Operational before dispatching a train.',
 rail_route_has_active_journey:'A train is currently running on this service. Cancel it or let it arrive before editing or retiring the service.',
 rail_journey_already_running:'A train is already travelling on this service.',
 rail_route_not_active:'Activate this service before dispatching a train.',
 rail_route_stop_no_longer_order_owned:'The origin or destination is no longer an eligible Order location.',
 rail_journey_not_running:'This journey has already arrived or was cancelled.',
 rail_route_not_found:'This rail service could not be found. Refresh and try again.',
 rail_station_not_found:'This railway station could not be found. Refresh and try again.',
 rail_action_not_found:'This railway action is unavailable. Check that the Windows API has been updated.'
};
async function request(path,{method='GET',token,body}={}){
 let response;
 try{response=await fetch(API+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'})}
 catch{throw new Error('The Order ledger is temporarily unavailable. Try again later.')}
 const data=response.status===204?{}:await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(ERROR_MESSAGES[data.error]||data.message||data.error||'Request failed ('+response.status+')');
 return data;
}
export default function LocalAccounts(){
 const [token,setToken]=useState(()=>sessionStorage.getItem(storageKey)||'');
 const [profile,setProfile]=useState(null);
 const [message,setMessage]=useState('');
 const [reason,setReason]=useState(()=>new URLSearchParams(window.location.search).get('access')||'');
 const [busy,setBusy]=useState(false);
 const [adult,setAdult]=useState(false);
 const [recruitment,setRecruitment]=useState(null);
 useEffect(()=>{
  let active=true;
  request('/recruitment').then(r=>{if(active)setRecruitment(r.status)}).catch(()=>{if(active)setRecruitment(null)});
  return()=>{active=false};
 },[]);
 const processed=useRef(false);
 async function start(intent='login'){
  if(intent==='join'&&recruitment==='closed'){setMessage(ERROR_MESSAGES.recruitment_closed);return}
  if(!adult){setMessage('Please confirm you are 18 or older and understand the Bad End FC premise.');return}
  setMessage('');setReason('');setBusy(true);
  try{
   const result=await request('/auth/discord/start',{method:'POST',body:{intent,adult_confirmed:true}});
   window.location.assign(result.authorization_url);
  }catch(e){setMessage(e.message);setBusy(false)}
 }
 useEffect(()=>{
  if(processed.current)return;
  const fragment=new URLSearchParams(window.location.hash.slice(1));
  if(!fragment.has('discord_ticket')&&!fragment.has('discord_error'))return;
  processed.current=true;
  const ticket=fragment.get('discord_ticket'),error=fragment.get('discord_error');
  window.history.replaceState(null,'',window.location.pathname+window.location.search);
  if(error){setReason(error);setMessage(ERROR_MESSAGES[error]||'Discord sign-in could not be completed. Try again.');if(['discord_not_in_server','discord_membership_screening','discord_server_check_unavailable','discord_guild_configuration_error'].includes(error)){const url=new URL(window.location.href);url.searchParams.set('portal','');url.searchParams.set('access',error);window.history.replaceState(null,'',url.pathname+url.search)}return}
  if(!ticket)return;
  setBusy(true);
  request('/auth/discord/complete',{method:'POST',body:{ticket}}).then(result=>{
   if(result.status==='pending'){setReason('pending');setMessage('Your Discord is connected, but we could not find an approved Order account linked to it.');return}
   if(result.access_token){sessionStorage.setItem(storageKey,result.access_token);setToken(result.access_token)}
  }).catch(e=>{setMessage(e.message);const match=Object.keys(ERROR_MESSAGES).find(key=>ERROR_MESSAGES[key]===e.message);if(['discord_not_in_server','discord_membership_screening','discord_server_check_unavailable','discord_guild_configuration_error'].includes(match)){setReason(match);const url=new URL(window.location.href);url.searchParams.set('portal','');url.searchParams.set('access',match);window.history.replaceState(null,'',url.pathname+url.search)}}).finally(()=>setBusy(false));
 },[]);
 useEffect(()=>{
  if(!token)return;
  let active=true;
  request('/auth/me',{token}).then(result=>{if(active)setProfile(result.user)}).catch(()=>{
   if(active){sessionStorage.removeItem(storageKey);setToken('');setProfile(null)}
  });
  return()=>{active=false};
 },[token]);
 async function logout(){
  try{await request('/auth/logout',{method:'POST',token})}catch{}
  sessionStorage.removeItem(storageKey);setProfile(null);setToken('');
 }
 const accessIssue=['discord_not_in_server','discord_membership_screening','discord_server_check_unavailable','discord_guild_configuration_error','pending'].includes(reason);
 if(!profile&&accessIssue)return <DiscordAccessPage reason={reason} busy={busy} adult={adult} onAdultChange={setAdult} onRetry={()=>start('login')} onJoin={()=>start('join')} onBack={()=>{setReason('');setMessage('');const u=new URL(window.location.href);u.searchParams.delete('access');window.history.replaceState(null,'',u.pathname+u.search)}}/>;
 if(profile)return <LocalWorkspace profile={profile} request={(path,options={})=>request(path,{...options,token})} onLogout={logout}/>;
 return <div className="eo-local">
  <header className="eo-local-head"><div><span className="eo-mark"><OrderEmblem className="eo-login-emblem"/></span><strong>ECLIPSE ORDER</strong><small>MEMBERSHIP LEDGER</small></div></header>
  <main className="eo-auth-card eo-discord-only">
   <span className="eo-eyebrow">THE ORDER AWAITS</span>
   <h1>Enter the Order</h1>
   <p>Sign in with Discord to enter the Order. Your existing membership and characters will be here once your accounts are connected.</p>
   <div className="eo-bad-end-note"><strong>A Bad End Roleplay Free Company</strong><p>The Order’s story explores captivity, power, loss of agency, and lasting consequences. Characters can face severe outcomes, including death or enforced service. Player consent and out-of-character boundaries always take priority.</p></div>
   <label className="eo-check eo-discord-consent"><input type="checkbox" checked={adult} onChange={e=>setAdult(e.target.checked)}/><span>I confirm I am at least 18 and understand the Bad End RP premise and the importance of consent.</span></label>
   {message&&<p className="eo-message" role="status">{message}</p>}
   <div className="eo-discord-login">
    <button className="eo-discord-button" type="button" disabled={busy||!adult} onClick={()=>start('login')}>{busy?'Connecting…':'Continue with Discord'}</button>
    {(reason==='discord_not_in_server'||reason==='discord_membership_screening')&&recruitment!=='closed'&&<button className="eo-primary eo-join-discord" type="button" disabled={busy||!adult} onClick={()=>start('join')}>Request to join the Order’s Discord</button>}
    {recruitment==='closed'&&<p className="eo-membership-wait">Recruitment is closed. Existing Order members may still sign in.</p>}
    {reason==='pending'&&<p className="eo-membership-wait">Already have an Order account? It needs to be reconnected to your Discord before you can enter. Your existing character records remain safe. New membership requests require approval from Order leadership.</p>}
    <small>Members of the Order can enter using their connected Discord account.</small>
   </div>
   <a className="eo-link" href="./">Return to the public website</a>
  </main>
 </div>;
}
