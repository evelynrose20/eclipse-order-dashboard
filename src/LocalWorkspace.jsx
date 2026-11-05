import React,{useEffect,useState} from 'react';
import {FullDndSheet,LimitedSheet,ACCOUNT_ROLES} from './OrderSheets.jsx';
import './dashboard.css';
import './local-accounts.css';

const ROLE_OPTIONS=['member','handler','high_command','domina'];
const STANDINGS=['initiate','associate','established','veteran'];
const field=(label,value,update)=> <label className="field"><span>{label}</span><input value={value??''} onChange={e=>update(e.target.value)}/></label>;
const canManage=role=>role==='domina'||role==='high_command';
const newSheet=()=>({name:'',player:'',owner:'',specialty:'',notes:'',rank:'Unbound: Free',collar_bound:false,
 hp:20,max_hp:20,armor_class:10,level:1,class_name:'',species:'',str:10,dex:10,con:10,int:10,wis:10,cha:10});
export default function LocalWorkspace({profile,request,onLogout}){
 const [tab,setTab]=useState('overview');
 const [members,setMembers]=useState([]);
 const [characters,setCharacters]=useState([]);
 const [selected,setSelected]=useState('');
 const [draft,setDraft]=useState(null);
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const [filter,setFilter]=useState('');
 const load=async()=>{
  const roster=await request('/characters');
  setCharacters(roster);
  setSelected(old=>old&&roster.some(c=>c.id===old)?old:roster[0]?.id||'');
  if(profile.role==='domina')setMembers(await request('/admin/accounts'));
 };
 useEffect(()=>{load().catch(err=>setMessage(err.message))},[profile.id]);
 const pending=members.filter(m=>m.approval_status==='pending');
 const active=members.filter(m=>m.approval_status==='approved');
 const character=characters.find(c=>c.id===selected);
 const admin=canManage(profile.role);
 const navigation=[
  ['overview','Overview','◈'],
  ['roster','Character roster','▦'],
  ['sheet','Character sheets','◇'],
  ...(profile.role==='domina'?[['members','Order accounts','♛']]:[]),
  ['encounters','Encounters & dice','⚄'],
  ['events','Events & signups','◷'],
  ['profile','My RP profile','♡'],
  ['transitions','Binding requests','◇'],
  ['settings','Workspace & backup','⚙']
 ];
 const act=async(id,action,payload={})=>{
  setBusy(true);setMessage('');
  try{await request('/admin/accounts/'+id+'/'+action,{method:'POST',body:payload});await load();setMessage('Account updated successfully.')}
  catch(err){setMessage(err.message)}
  finally{setBusy(false)}
 };
 const save=async()=>{
  if(!draft?.name?.trim())return setMessage('Enter a character name.');
  setBusy(true);setMessage('');
  try{
   const created=await request(draft.id?'/characters/'+draft.id:'/characters',
    {method:draft.id?'PUT':'POST',body:draft});
   setDraft(null);await load();
   if(created.id)setSelected(created.id);
   setMessage('Character saved in MySQL.');
  }catch(err){setMessage(err.message)}
  finally{setBusy(false)}
 };
 const mut=(key,value)=>setDraft(d=>({...d,[key]:value}));
 const disabledInfo={
  encounters:['Encounters & dice','The encounter system is being connected to MySQL. The existing Supabase encounters are not available in this local workspace yet.'],
  events:['Events & signups','Event planning and player signups will use MySQL when the corresponding API permissions are finished.'],
  profile:['My RP profile','Private content preferences and kink lists remain unavailable in this local build until server-side privacy controls are implemented.'],
  transitions:['Binding requests','Player-approved binding transitions must be implemented before anyone can change a linked character’s collar status.'],
  settings:['Workspace & backup','Your account and new characters live in the local eclipse_order MySQL database. Backups and additional account tools are next.']
 };
 return <div className="app-shell eo-local">
  <aside className="sidebar">
   <div className="brand"><span className="brand-sigil">✦</span><div><strong>ECLIPSE ORDER</strong><small>THE UNDERWORLD LEDGER</small></div></div>
   <div className="workspace-chip"><span className="pulse"/> Windows workspace<small>MySQL database</small></div>
   <p className="nav-label">COMMAND CENTER</p>
   <nav aria-label="Primary navigation">{navigation.map(([id,label,mark])=><button key={id} className={'nav-link '+(tab===id?'active':'')} onClick={()=>{setTab(id);setDraft(null);setMessage('')}}><span className="nav-symbol">{mark}</span>{label}{id==='members'&&pending.length>0?<em className="eo-nav-count">{pending.length}</em>:null}</button>)}</nav>
   <div className="side-bottom"><div className="monogram">EO</div><div><strong>{ACCOUNT_ROLES[profile.role]?.label||'Member'}</strong><small>{profile.email}</small></div></div>
  </aside>
  <main className="main">
   <header className="topbar"><div className="breadcrumb">ECLIPSE ORDER <span>/</span> {navigation.find(n=>n[0]===tab)?.[1]}</div><div className="top-actions"><span className="local-status"><span className="pulse"/> Local MySQL</span><button className="mini-btn" onClick={onLogout}>Sign out</button></div></header>
   <div className="content">
    <div className="page-intro"><div><div className="eyebrow">ORDER OPERATIONS</div><h1>{navigation.find(n=>n[0]===tab)?.[1]}</h1><p>{tab==='overview'?'Your Order at a glance.':tab==='members'?'Approve membership requests and manage account roles.':'The Order’s private MySQL workspace.'}</p></div></div>
    {message&&<div className="alert" role="status">{message}</div>}
    {tab==='overview'&&<>
     <div className="eo-summary"><div><strong>{characters.length}</strong><span>Visible characters</span></div>{profile.role==='domina'&&<div><strong>{pending.length}</strong><span>Pending accounts</span></div>}<div><strong>{active.length||(profile.role==='domina'?0:'—')}</strong><span>Approved members</span></div></div>
     <section className="panel"><h2>Welcome, {profile.display_name}</h2><p>Your account and character records are now running through the Windows API and local MySQL. Continue with the navigation to manage the roster and memberships.</p></section>
    </>}
    {tab==='members'&&profile.role==='domina'&&<>
     <div className="eo-toolbar"><h2>Pending membership requests ({pending.length})</h2><button className="btn secondary" onClick={()=>load().catch(err=>setMessage(err.message))}>Refresh</button></div>
     {!pending.length?<div className="panel"><p>No pending account requests.</p></div>:pending.map(m=><article className="eo-member" key={m.user_id}><div><strong>{m.display_name}</strong><small>{m.email}</small><span>Requested {new Date(m.created_at).toLocaleDateString()}</span></div><div className="eo-actions"><button className="eo-primary" disabled={busy} onClick={()=>act(m.user_id,'approve')}>Approve</button><button disabled={busy} onClick={()=>{if(window.confirm('Reject this membership request?'))act(m.user_id,'reject')}}>Reject</button></div></article>)}
     <h2 className="eo-member-title">Approved accounts</h2>
     {active.map(m=><article className="eo-member" key={m.user_id}><div><strong>{m.display_name}</strong><small>{m.email}</small></div><div className="eo-actions"><label>Role<select value={m.role} disabled={busy||m.user_id===profile.id} onChange={e=>act(m.user_id,'role',{role:e.target.value})}>{ROLE_OPTIONS.map(role=><option value={role} key={role}>{ACCOUNT_ROLES[role]?.label||role}</option>)}</select></label><label>Standing<select value={m.standing} disabled={busy} onChange={e=>act(m.user_id,'standing',{standing:e.target.value})}>{STANDINGS.map(s=><option key={s} value={s}>{s}</option>)}</select></label></div></article>)}
    </>}
    {tab==='roster'&&<>
     <div className="eo-toolbar"><h2>Character records</h2>{admin&&<button className="btn primary" onClick={()=>{setDraft(newSheet());setTab('sheet')}}>+ Create character</button>}</div>
     <input className="eo-search" placeholder="Search characters…" aria-label="Search characters" value={filter} onChange={e=>setFilter(e.target.value)}/>
     {!characters.length?<section className="panel"><h3>No characters yet</h3><p>This database starts empty, ready for new Eclipse Order character sheets.</p></section>:<div className="eo-character-grid">{characters.filter(c=>[c.name,c.player,c.specialty].join(' ').toLowerCase().includes(filter.toLowerCase())).map(c=><button key={c.id} className="eo-character" onClick={()=>{setSelected(c.id);setTab('sheet')}}><strong>{c.name}</strong><span>{c.rank}</span><small>{c.class_name||'No class set'} · {c.view_mode==='bound'?'Restricted sheet':'Full sheet'}</small></button>)}</div>}
    </>}
    {tab==='sheet'&&<>
     <div className="eo-toolbar"><h2>Character sheets</h2>{admin&&<button className="btn primary" onClick={()=>setDraft(newSheet())}>+ New sheet</button>}</div>
     {characters.length>0&&<select className="eo-sheet-picker" value={selected} onChange={e=>{setSelected(e.target.value);setDraft(null)}}>{characters.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select>}
     {draft?<section className="panel eo-editor"><h2>{draft.id?'Edit character':'New character'}</h2><div className="form-grid">
      {field('Character name',draft.name,v=>mut('name',v))}
      {field('Player display name',draft.player,v=>mut('player',v))}
      {field('Class / job',draft.class_name,v=>mut('class_name',v))}
      {field('Species',draft.species,v=>mut('species',v))}
      {field('Specialty',draft.specialty,v=>mut('specialty',v))}
      {field('HP',draft.hp,v=>mut('hp',Number(v)))}
      {field('Maximum HP',draft.max_hp,v=>mut('max_hp',Number(v)))}
      {field('Armor class',draft.armor_class,v=>mut('armor_class',Number(v)))}
      {field('Level',draft.level,v=>mut('level',Number(v)))}
      {['str','dex','con','int','wis','cha'].map(x=><React.Fragment key={x}>{field(x.toUpperCase(),draft[x],v=>mut(x,Number(v)))}</React.Fragment>)}
     </div><label className="field"><span>Notes</span><textarea value={draft.notes||''} onChange={e=>mut('notes',e.target.value)} rows={5}/></label><div className="eo-actions"><button className="btn primary" disabled={busy} onClick={save}>Save character</button><button className="btn secondary" onClick={()=>setDraft(null)}>Cancel</button></div><p className="fine-print">Binding status and character ownership require separate player-approval and assignment flows. They cannot be altered through this editor.</p></section>:
     character?<><div className="eo-sheet-head"><h2>{character.name}</h2>{admin||profile.role==='handler'||(!character.collar_bound&&character.player_user_id===profile.id)?<button className="btn secondary" onClick={()=>{if(character.view_mode==='full')setDraft({...character})}}>Edit sheet</button>:null}</div>{character.view_mode==='bound'?<LimitedSheet character={character}/>:<FullDndSheet character={character}/>}</>:
     <section className="panel"><h3>No character selected</h3><p>Create a character to get started.</p></section>}
    </>}
    {disabledInfo[tab]&&<section className="panel"><h2>{disabledInfo[tab][0]}</h2><p>{disabledInfo[tab][1]}</p></section>}
   </div>
  </main>
 </div>;
}
