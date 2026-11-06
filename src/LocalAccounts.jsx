import React,{useEffect,useRef,useState} from 'react';
import './local-accounts.css';
import LocalWorkspace from './LocalWorkspace.jsx';

const API=(import.meta.env.VITE_ECLIPSE_API_URL||'').replace(/\/+$/,'');
const storageKey='eclipse-order-local-session';
async function request(path,{method='GET',token,body}={}){
 let response;
 try{response=await fetch(API+path,{method,headers:{
  ...(body?{'Content-Type':'application/json'}:{}),
  ...(token?{Authorization:'Bearer '+token}:{})
 },body:body?JSON.stringify(body):undefined,cache:'no-store'});}catch{
  throw new Error("The Order's records are temporarily unavailable. Please try again shortly.");
 }
 const data=response.status===204?{}:await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(({
  account_pending_approval:'Your request is awaiting Domina approval.',
  account_not_approved:'This account is not approved.',
  invalid_credentials:'That email or password was not accepted.',
  too_many_attempts:'Too many attempts. Try again later.',
  discord_login_not_configured:'Discord sign-in is not available yet. The Order administrator must finish the Discord application setup.',
  discord_identity_taken:'This Discord identity is already linked to another account.',
  discord_account_not_linked:'Please sign in with your existing Order account and connect Discord before using Discord sign-in.',
  discord_link_session_required:'Your Order session expired. Sign in again, then connect Discord.',
  discord_ticket_expired:'Discord authentication expired. Please try again.',
  discord_already_linked:'Discord is already linked to your Order account.'
 })[data.error]||data.message||data.error||'Request failed ('+response.status+')');
 return data;
}
export default function LocalAccounts(){
 const [token,setToken]=useState(()=>sessionStorage.getItem(storageKey)||'');
 const [profile,setProfile]=useState(null);
 const [mode,setMode]=useState('sign-in');
 const [checkingSetup,setCheckingSetup]=useState(true);
 const [email,setEmail]=useState('');
 const [name,setName]=useState('');
 const [password,setPassword]=useState('');
 const [confirm,setConfirm]=useState('');
 const [adult,setAdult]=useState(false);
 const [rows,setRows]=useState([]);
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const discordCallbackHandled=useRef(false);
 async function beginDiscord(){
  setMessage('');setBusy(true);
  try{const result=await request('/auth/discord/start',{method:'POST'});window.location.assign(result.authorization_url)}
  catch(e){setMessage(e.message);setBusy(false)}
 }
 useEffect(()=>{
  if(discordCallbackHandled.current)return;
  const fragment=new URLSearchParams(window.location.hash.slice(1));
  if(!fragment.has('discord_ticket')&&!fragment.has('discord_error'))return;
  discordCallbackHandled.current=true;
  const ticket=fragment.get('discord_ticket'),problem=fragment.get('discord_error');
  window.history.replaceState(null,'',window.location.pathname+window.location.search);
  if(problem){setMessage(({
   discord_denied:'Discord authorization was cancelled.',
   discord_account_not_linked:'This Discord account is not linked yet. Sign in with your Eclipse Order account first, then connect Discord from your dashboard.',
   discord_identity_taken:'That Discord identity is already connected to a different Order account.',
   discord_already_linked:'Discord is already connected to this account.',
   discord_expired_request:'Discord sign-in expired. Start again.',
   discord_unavailable:'Discord could not verify your identity. Please retry.'
  })[problem]||'Discord sign-in could not be completed. Please retry.');return}
  if(!ticket)return;
  setBusy(true);
  request('/auth/discord/complete',{method:'POST',token:sessionStorage.getItem(storageKey)||undefined,body:{ticket}}).then(async result=>{
   if(result.status==='linked'){setMessage('Discord connected successfully. You can now sign in with Discord.');window.dispatchEvent(new Event('eclipse-discord-linked'));return}
   if(result.access_token){sessionStorage.setItem(storageKey,result.access_token);setToken(result.access_token);setPassword('')}
  }).catch(e=>setMessage(e.message)).finally(()=>setBusy(false));
 },[]);
 useEffect(()=>{
  // Initial Domina bootstrap is intentionally local-only; the public API returns 404.
  // Do not call it from the deployed website or show a false setup error on sign-in.
  if(!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(API)){
   setCheckingSetup(false);return;
  }
  let live=true;
  request('/auth/setup-status').then(result=>{if(live&&result.needs_setup){setMode('setup');setMessage('Establish the first Domina account to lead the Order.')}}).catch(error=>{if(live)setMessage('Unable to open first-account registration: '+error.message)}).finally(()=>{if(live)setCheckingSetup(false)});
  return()=>{live=false};
 },[]);
 const reload=async(access=token)=>{
  const r=await request('/auth/me',{token:access});
  setProfile(r.user);
  if(r.user.role==='domina')setRows(await request('/admin/accounts',{token:access}));
 };
 useEffect(()=>{if(!token)return;let live=true;request('/auth/me',{token}).then(r=>{
  if(!live)return;setProfile(r.user);
  if(r.user.role==='domina')request('/admin/accounts',{token}).then(data=>{if(live)setRows(data)}).catch(()=>{});
 }).catch(()=>{if(live){sessionStorage.removeItem(storageKey);setToken('');setProfile(null);}});return()=>{live=false}},[token]);
 async function submit(event){
  event.preventDefault();setMessage('');setBusy(true);
  try{
   if(mode==='setup'){
    if(password!==confirm)throw new Error('Passwords must match.');
    const result=await request('/auth/setup-domina',{method:'POST',body:{email,display_name:name,password}});
    setMessage(result.message);setMode('sign-in');setPassword('');setConfirm('');
   }else if(mode==='register'){
    if(password!==confirm)throw new Error('Passwords must match.');
    const result=await request('/auth/register',{method:'POST',body:{email,display_name:name,password,adult_declaration:adult}});
    setMessage(result.message);setMode('sign-in');setPassword('');setConfirm('');
   }else{
    const result=await request('/auth/login',{method:'POST',body:{email,password}});
    sessionStorage.setItem(storageKey,result.access_token);
    setToken(result.access_token);setPassword('');
    await reload(result.access_token);
   }
  }catch(e){setMessage(e.message)}
  finally{setBusy(false)}
 }
 async function change(id,action,payload={}){
  setMessage('');
  try{await request('/admin/accounts/'+id+'/'+action,{method:'POST',token,body:payload});
   setRows(await request('/admin/accounts',{token}));setMessage('Account updated.');
  }catch(e){setMessage(e.message)}
 }
 async function logout(){
  try{await request('/auth/logout',{method:'POST',token})}catch{}
  sessionStorage.removeItem(storageKey);setToken('');setProfile(null);setRows([]);
 }
 const pending=rows.filter(r=>r.approval_status==='pending');
 const approved=rows.filter(r=>r.approval_status==='approved');
 if(profile)return <LocalWorkspace profile={profile} request={(path,options={})=>request(path,{...options,token})} onLogout={logout}/>;
 return <div className="eo-local">
  <header className="eo-local-head"><div><span className="eo-mark">✦</span><strong>ECLIPSE ORDER</strong><small>MEMBERSHIP LEDGER</small></div>{profile&&<button onClick={logout}>Sign out</button>}</header>
  {!profile?<main className="eo-auth-card">
   <span className="eo-eyebrow">THE ORDER AWAITS</span>
   <h1>{mode==='setup'?'Create your Domina account':mode==='register'?'Request membership':'Enter the Order'}</h1>
   <p>{mode==='setup'?'Establish the first Domina account and choose a secure password.':mode==='register'?'Create your account. Access begins after the Domina approves your request.':'Sign in using your Eclipse Order account.'}</p>
   <form onSubmit={submit}>
    {(mode==='register'||mode==='setup')&&<label>Display name<input required minLength={2} maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label>}
    <label>Email<input required type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}/></label>
    <label>Password<input required type="password" minLength={mode==='register'||mode==='setup'?16:1} autoComplete={mode==='register'||mode==='setup'?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)}/></label>
    {(mode==='register'||mode==='setup')&&<>
     <label>Confirm password<input required type="password" minLength={16} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
     {mode==='register'&&<label className="eo-check"><input required type="checkbox" checked={adult} onChange={e=>setAdult(e.target.checked)}/><span>I confirm I am 18 or older and understand this is an adult RP community.</span></label>}
    </>}
    {message&&<p className="eo-message" role="status">{message}</p>}
    <button className="eo-primary" type="submit" disabled={busy||checkingSetup}>{busy?'Working…':mode==='setup'?'Create Domina account':mode==='register'?'Submit membership request':'Sign in'}</button>
   {mode==='sign-in'&&<div className="eo-discord-login"><span>OR SIGN IN WITH</span><button type="button" className="eo-discord-button" disabled={busy||checkingSetup} onClick={beginDiscord}><svg aria-hidden="true" width="22" height="18" viewBox="0 0 127.14 96.36" fill="currentColor"><path d="M104.4 8.19A99.83 99.83 0 0 0 79.56.5a69.4 69.4 0 0 0-3.18 6.57 92.9 92.9 0 0 0-27.68 0A69.4 69.4 0 0 0 45.52.5a99.84 99.84 0 0 0-24.84 7.69C5.02 31.55.77 54.32 2.9 76.77a100.2 100.2 0 0 0 30.48 15.41 73.82 73.82 0 0 0 6.53-10.62 64.87 64.87 0 0 1-10.28-4.95c.86-.62 1.7-1.26 2.52-1.92a71.15 71.15 0 0 0 61.16 0c.82.66 1.66 1.3 2.52 1.92a64.87 64.87 0 0 1-10.28 4.95 73.82 73.82 0 0 0 6.53 10.62 100.2 100.2 0 0 0 30.48-15.41c2.53-26.01-4.33-48.57-18.16-68.58ZM42.45 63.05c-5.81 0-10.56-5.29-10.56-11.78s4.66-11.78 10.56-11.78 10.65 5.29 10.56 11.78c0 6.49-4.66 11.78-10.56 11.78Zm42.24 0c-5.81 0-10.56-5.29-10.56-11.78s4.66-11.78 10.56-11.78 10.65 5.29 10.56 11.78c0 6.49-4.66 11.78-10.56 11.78Z"/></svg> Continue with Discord</button><small>First time? Sign in with your Order account and link Discord from your dashboard.</small></div>}
   </form>
   {mode!=='setup'&&<button className="eo-link" onClick={()=>{setMessage('');setMode(mode==='register'?'sign-in':'register')}}>{mode==='register'?'Already have an account? Sign in':'Need an account? Request membership'}</button>}
  </main>:<main className="eo-members">
   <span className="eo-eyebrow">ORDER DASHBOARD</span>
   <h1>Welcome, {profile.display_name}</h1><p>Signed in as <strong>{profile.role.replace('_',' ')}</strong>.</p>
   {profile.role==='domina'?<>
    <div className="eo-summary"><div><strong>{pending.length}</strong><span>Pending requests</span></div><div><strong>{approved.length}</strong><span>Approved accounts</span></div></div>
    <div className="eo-toolbar"><h2>Pending account requests</h2><button onClick={()=>reload().catch(e=>setMessage(e.message))}>Refresh</button></div>
    {pending.length===0?<p className="eo-empty">No pending membership requests.</p>:pending.map(m=><article className="eo-member" key={m.user_id}><div><strong>{m.display_name}</strong><small>{m.email}</small><span>Requested {new Date(m.created_at).toLocaleDateString()}</span></div><div className="eo-actions"><button className="eo-primary" onClick={()=>change(m.user_id,'approve')}>Approve</button><button onClick={()=>{if(window.confirm('Reject this account request?'))change(m.user_id,'reject')}}>Reject</button></div></article>)}
    <h2>Approved members</h2>
    {approved.map(m=><article className="eo-member" key={m.user_id}><div><strong>{m.display_name}</strong><small>{m.email}</small></div><div className="eo-actions"><label>Role<select value={m.role} disabled={m.user_id===profile.id} onChange={e=>change(m.user_id,'role',{role:e.target.value})}>{['member','handler','high_command','domina'].map(role=><option value={role} key={role}>{role.replace('_',' ')}</option>)}</select></label><label>Standing<select value={m.standing} onChange={e=>change(m.user_id,'standing',{standing:e.target.value})}>{['initiate','associate','established','veteran'].map(s=><option key={s} value={s}>{s}</option>)}</select></label></div></article>)}
   </>:<p className="eo-empty">Your membership is approved. Enter the Order to view your character records and events.</p>}
   {message&&<p className="eo-message" role="status">{message}</p>}
  </main>}
 </div>;
}
