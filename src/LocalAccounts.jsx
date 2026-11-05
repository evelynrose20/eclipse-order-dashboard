import React,{useEffect,useState} from 'react';
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
  too_many_attempts:'Too many attempts. Try again later.'
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
