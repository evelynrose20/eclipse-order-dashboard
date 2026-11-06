import React,{useEffect,useRef,useState} from 'react';
import './local-accounts.css';
import LocalWorkspace from './LocalWorkspace.jsx';
import DiscordAccessPage from './DiscordAccessPage.jsx';

const API=(import.meta.env.VITE_ECLIPSE_API_URL||'').replace(/\/+$/,'');
const storageKey='eclipse-order-local-session';
const ERROR_MESSAGES={
 discord_login_not_configured:'Discord sign-in has not been configured yet. Contact Order command.',
 discord_not_in_server:'You must join The Eclipse Order’s Discord before accessing the member portal.',
 discord_membership_screening:'Finish the Discord server’s membership screening, then sign in again.',
 discord_server_check_unavailable:'The Order could not verify Discord membership. Please try again later.',
 discord_guild_configuration_error:'Discord server configuration needs attention. This does not mean you have left the server.',
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
 too_many_attempts:'Too many attempts. Try again later.'
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
 const [reason,setReason]=useState('');
 const [busy,setBusy]=useState(false);
 const [adult,setAdult]=useState(false);
 const processed=useRef(false);
 async function start(intent='login'){
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
  if(error){setReason(error);setMessage(ERROR_MESSAGES[error]||'Discord sign-in could not be completed. Try again.');return}
  if(!ticket)return;
  setBusy(true);
  request('/auth/discord/complete',{method:'POST',body:{ticket}}).then(result=>{
   if(result.status==='pending'){setReason('pending');setMessage(result.message);return}
   if(result.access_token){sessionStorage.setItem(storageKey,result.access_token);setToken(result.access_token)}
  }).catch(e=>{setMessage(e.message);if(e.message===ERROR_MESSAGES.discord_not_in_server)setReason('discord_not_in_server')}).finally(()=>setBusy(false));
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
 if(profile)return <LocalWorkspace profile={profile} request={(path,options={})=>request(path,{...options,token})} onLogout={logout}/>;
 if(['discord_not_in_server','discord_membership_screening','discord_guild_configuration_error','discord_server_check_unavailable','pending'].includes(reason))return <DiscordAccessPage reason={reason} busy={busy} adult={adult} onAdultChange={setAdult} onRetry={()=>start('login')} onJoin={()=>start('join')} onBack={()=>{setReason('');setMessage('')}}/>;
 return <div className="eo-local">
  <header className="eo-local-head"><div><span className="eo-mark">✦</span><strong>ECLIPSE ORDER</strong><small>MEMBERSHIP LEDGER</small></div></header>
  <main className="eo-auth-card eo-discord-only">
   <span className="eo-eyebrow">THE ORDER AWAITS</span>
   <h1>Enter the Order</h1>
   <p>Use your Discord identity to enter the member portal. You must be in the Order’s Discord server and receive membership approval.</p>
   <div className="eo-bad-end-note"><strong>A Bad End Roleplay Free Company</strong><p>The Order’s story explores captivity, power, loss of agency, and lasting consequences. Characters can face severe outcomes, including death or enforced service. Player consent and out-of-character boundaries always take priority.</p></div>
   <label className="eo-check eo-discord-consent"><input type="checkbox" checked={adult} onChange={e=>setAdult(e.target.checked)}/><span>I confirm I am at least 18 and understand the Bad End RP premise and the importance of consent.</span></label>
   {message&&<p className="eo-message" role="status">{message}</p>}
   <div className="eo-discord-login">
    <button className="eo-discord-button" type="button" disabled={busy||!adult} onClick={()=>start('login')}>{busy?'Connecting…':'Continue with Discord'}</button>
    {(reason==='discord_not_in_server'||reason==='discord_membership_screening')&&<button className="eo-primary eo-join-discord" type="button" disabled={busy||!adult} onClick={()=>start('join')}>Request to join the Order’s Discord</button>}
    {reason==='pending'&&<p className="eo-membership-wait">Your request is awaiting review by Order command. You will be able to enter the portal after approval.</p>}
    <small>Discord membership is verified on the server. New members request access automatically; joining Discord does not grant portal approval.</small>
   </div>
   <a className="eo-link" href="./">Return to the public website</a>
  </main>
 </div>;
}
