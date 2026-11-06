import React,{useEffect,useState} from 'react';
import './discord-account.css';

export default function DiscordAccountConnection({request,readOnly=false}){
 const [status,setStatus]=useState(null);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 async function load(){
  const result=await request('/auth/discord/status');
  setStatus(result);
 }
 useEffect(()=>{let alive=true;
  request('/auth/discord/status').then(data=>{if(alive)setStatus(data)}).catch(error=>{if(alive)setMessage(error.message)});
  const refresh=()=>load().catch(error=>setMessage(error.message));
  window.addEventListener('eclipse-discord-linked',refresh);
  return()=>{alive=false;window.removeEventListener('eclipse-discord-linked',refresh)};
 },[request]);
 async function connect(){
  setBusy(true);setMessage('');
  try{const data=await request('/auth/discord/start',{method:'POST'});window.location.assign(data.authorization_url)}
  catch(e){setMessage(e.message);setBusy(false)}
 }
 async function unlink(){
  if(!window.confirm('Disconnect Discord from your Order account? You can still sign in with your password.'))return;
  setBusy(true);setMessage('');
  try{await request('/auth/discord/unlink',{method:'POST'});await load();setMessage('Discord disconnected.')}
  catch(e){setMessage(e.message)}finally{setBusy(false)}
 }
 return <section className="discord-account-panel" aria-labelledby="discord-account-heading">
  <div className="discord-account-title"><span className="discord-account-glyph" aria-hidden="true">◈</span><div><h3 id="discord-account-heading">Discord sign-in</h3><p>Connect Discord to the Eclipse Order account you already use.</p></div></div>
  {status?.linked?<div className="discord-account-row"><div><strong>Connected</strong><span>{status.username||'Discord account'}</span></div>{!readOnly&&<button type="button" className="btn secondary" disabled={busy} onClick={unlink}>Disconnect</button>}</div>
  :<div className="discord-account-row"><div><strong>{status?.enabled?'Not connected':'Setup required'}</strong><span>{status?.enabled?'Link once to use Discord when signing in.':'Discord sign-in has not been configured on the server.'}</span></div>{!readOnly&&<button type="button" className="btn secondary" disabled={busy||!status?.enabled} onClick={connect}>Connect Discord</button>}</div>}
  {message&&<p className="discord-account-message" role="status">{message}</p>}
 </section>;
}
