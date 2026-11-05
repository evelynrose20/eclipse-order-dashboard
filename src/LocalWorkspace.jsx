import React,{useEffect,useState} from 'react';
import {FullDndSheet,LimitedSheet,ACCOUNT_ROLES} from './OrderSheets.jsx';
import Encounters from './Encounters.jsx';
import {CharacterTransitions} from './RPPlatform.jsx';
import {ProfileConsent} from './ProfileConsent.jsx';
import {MemberRPDirectory} from './MemberRPDirectory.jsx';
import FCSettings from './FCSettings.jsx';
import InlineSheetEditor from './InlineSheetEditor.jsx';
import {SHOP_ITEMS,RANKS} from './data/initialData.js';
import EconomyPanel from './EconomyPanel.jsx';
import {SYNDICATE_RANKS,syndicateRankLabel} from './syndicateRanks.js';
import './dashboard.css';
import './local-accounts.css';

const ROLE_OPTIONS=['member','handler','high_command','domina'];
const field=(label,value,update)=> <label className="field"><span>{label}</span><input value={value??''} onChange={e=>update(e.target.value)}/></label>;
const canManage=role=>role==='domina'||role==='high_command';
const newSheet=()=>({name:'',player:'',owner:'',specialty:'',notes:'',rank:'Unbound: Free',collar_bound:false,
 hp:10,max_hp:10,armor_class:10,level:1,experience:0,class_id:'',class_name:'',species:'',str:8,dex:8,con:8,int:8,wis:8,cha:8});
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
  ['market','Black Market','◆'],
  ...(profile.role==='domina'?[['members','Order accounts','♛']]:[]),
  ['encounters','Encounters & dice','⚄'],
  ['events','Events & signups','◷'],
  ['profile','My RP profile','♡'],
  ['directory','Member RP profiles','♧'],
  ['transitions','Binding requests','◇'],
  ['settings','Workspace & backup','⚙']
 ];
 const act=async(id,action,payload={})=>{
  setBusy(true);setMessage('');
  try{await request('/admin/accounts/'+id+'/'+action,{method:'POST',body:payload});await load();setMessage('Account updated successfully.')}
  catch(err){setMessage(err.message)}
  finally{setBusy(false)}
 };
 const save=async(form=draft)=>{
  if(!form?.name?.trim())return setMessage('Enter a character name.');
  setBusy(true);setMessage('');
  try{
   const created=await request(form.id?'/characters/'+form.id:'/characters',
    {method:form.id?'PUT':'POST',body:form});
   const id=form.id||created.id;
   if(admin&&id&&(form.player_user_id||form.handler_user_id))await request('/characters/'+id+'/assign',{
    method:'POST',body:{player_user_id:form.player_user_id||null,handler_user_id:form.handler_user_id||null}
   });
   setDraft(null);await load();
   if(created.id)setSelected(created.id);
   setMessage('Character saved in MySQL.');
  }catch(err){setMessage(err.message)}
  finally{setBusy(false)}
 };
 const mut=(key,value)=>setDraft(d=>({...d,[key]:value}));
 const disabledInfo={settings:['Workspace & backup','All records are stored locally in MySQL. Automatic backup and restore are not yet configured.']};
 return <div className="app-shell eo-local">
  <aside className="sidebar">
   <div className="brand"><span className="brand-sigil">✦</span><div><strong>ECLIPSE ORDER</strong><small>THE UNDERWORLD LEDGER</small></div></div>
   <div className="workspace-chip"><span className="pulse"/> Windows workspace<small>MySQL database</small></div>
   <p className="nav-label">COMMAND CENTER</p>
   <nav aria-label="Primary navigation">{navigation.map(([id,label,mark])=><button key={id} className={'nav-link '+(tab===id?'active':'')} onClick={()=>{setTab(id);setDraft(null);setMessage('')}}><span className="nav-symbol">{mark}</span>{label}{id==='members'&&pending.length>0?<em className="eo-nav-count">{pending.length}</em>:null}</button>)}</nav>
   <div className="side-bottom"><div className="monogram">EO</div><div><strong>{syndicateRankLabel(profile.syndicate_rank)}</strong><small>{profile.email}</small></div></div>
  </aside>
  <main className="main">
   <header className="topbar"><div className="breadcrumb">ECLIPSE ORDER <span>/</span> {navigation.find(n=>n[0]===tab)?.[1]}</div><div className="top-actions"><span className="local-status"><span className="pulse"/> Local MySQL</span><button className="mini-btn" onClick={onLogout}>Sign out</button></div></header>
   <div className="content">
    <div className="page-intro"><div><div className="eyebrow">ORDER OPERATIONS</div><h1>{navigation.find(n=>n[0]===tab)?.[1]}</h1><p>{tab==='overview'?'Your Order at a glance.':tab==='members'?'Approve membership requests; manage syndicate ranks and separate account permissions.':'The Order’s private MySQL workspace.'}</p></div></div>
    {message&&<div className="alert" role="status">{message}</div>}
    {tab==='overview'&&<>
     <div className="eo-summary"><div><strong>{characters.length}</strong><span>Visible characters</span></div>{profile.role==='domina'&&<div><strong>{pending.length}</strong><span>Pending accounts</span></div>}<div><strong>{active.length||(profile.role==='domina'?0:'—')}</strong><span>Approved members</span></div></div>
     <section className="panel"><h2>Welcome, {profile.display_name}</h2><p><strong>Syndicate rank:</strong> {syndicateRankLabel(profile.syndicate_rank)} · <strong>Account access:</strong> {ACCOUNT_ROLES[profile.role]?.label||profile.role}</p><p>Your account and character records are now running through the Windows API and local MySQL. Continue with the navigation to manage the roster and memberships.</p></section>
    </>}
    {tab==='members'&&profile.role==='domina'&&<>
     <div className="eo-toolbar"><h2>Pending membership requests ({pending.length})</h2><button className="btn secondary" onClick={()=>load().catch(err=>setMessage(err.message))}>Refresh</button></div>
     {!pending.length?<div className="panel"><p>No pending account requests.</p></div>:pending.map(m=><article className="eo-member" key={m.user_id}><div><strong>{m.display_name}</strong><small>{m.email}</small><span>Requested {new Date(m.created_at).toLocaleDateString()}</span></div><div className="eo-actions"><button className="eo-primary" disabled={busy} onClick={()=>act(m.user_id,'approve')}>Approve</button><button disabled={busy} onClick={()=>{if(window.confirm('Reject this membership request?'))act(m.user_id,'reject')}}>Reject</button></div></article>)}
     <h2 className="eo-member-title">Approved accounts</h2><p className="muted">Syndicate ranks are in-character titles. Account roles separately control dashboard permissions. Binding ranks are managed on character sheets.</p>
     {active.map(m=><article className="eo-member" key={m.user_id}><div><strong>{m.display_name}</strong><small>{m.email}</small></div><div className="eo-actions"><label>Role<select value={m.role} disabled={busy||m.user_id===profile.id} onChange={e=>act(m.user_id,'role',{role:e.target.value})}>{ROLE_OPTIONS.map(role=><option value={role} key={role}>{ACCOUNT_ROLES[role]?.label||role}</option>)}</select></label><label>Syndicate rank<select value={m.syndicate_rank||'kumi_in'} disabled={busy||m.user_id===profile.id} onChange={e=>act(m.user_id,'syndicate-rank',{syndicate_rank:e.target.value})}>{SYNDICATE_RANKS.filter(r=>r.id!=='domina'||m.role==='domina').map(r=><option key={r.id} value={r.id}>{r.label}</option>)}</select></label></div></article>)}
    </>}
    {tab==='roster'&&<>
     <div className="eo-toolbar"><h2>Character records</h2>{admin&&<button className="btn primary" onClick={()=>{setDraft(newSheet());setTab('sheet')}}>+ Create character</button>}</div>
     <input className="eo-search" placeholder="Search characters…" aria-label="Search characters" value={filter} onChange={e=>setFilter(e.target.value)}/>
     {!characters.length?<section className="panel"><h3>No characters yet</h3><p>This database starts empty, ready for new Eclipse Order character sheets.</p></section>:<div className="eo-character-grid">{characters.filter(c=>[c.name,c.player,c.specialty].join(' ').toLowerCase().includes(filter.toLowerCase())).map(c=><button key={c.id} className="eo-character" onClick={()=>{setSelected(c.id);setTab('sheet')}}><strong>{c.name}</strong><span>{c.rank}</span><small>{c.class_name||'No class set'} · {c.view_mode==='bound'?'Restricted sheet':'Full sheet'}</small></button>)}</div>}
    </>}
    {tab==='sheet'&&<>
     <div className="eo-toolbar"><h2>Character sheets</h2>{admin&&<button className="btn primary" onClick={()=>setDraft(newSheet())}>+ New sheet</button>}</div>
     {characters.length>0&&<select className="eo-sheet-picker" value={selected} onChange={e=>{setSelected(e.target.value);setDraft(null)}}>{characters.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select>}
     {draft?<InlineSheetEditor key={draft.id||'new'} character={draft} canCommand={admin} members={members} onSave={save} onCancel={()=>setDraft(null)} saving={busy}/>:
     character?<><div className="eo-sheet-head"><h2>{character.name}</h2>{admin||profile.role==='handler'||(!character.collar_bound&&character.player_user_id===profile.id)?<button className="btn secondary" onClick={()=>{if(character.view_mode==='full')setDraft({...character})}}>Edit sheet</button>:null}</div>{character.view_mode==='bound'?<LimitedSheet character={character}/>:<FullDndSheet character={character}/>}</>:
     <section className="panel"><h3>No character selected</h3><p>Create a character to get started.</p></section>}
    </>}
    {tab==='market'&&<EconomyPanel request={request} characters={characters} canCommand={admin} onRefresh={load}/>}
    {(tab==='encounters'||tab==='events')&&<Encounters role={profile.role} userId={profile.id} characters={characters} onOpenProfile={()=>setTab('profile')}/>}
    {tab==='profile'&&<ProfileConsent/>}
    {tab==='directory'&&<MemberRPDirectory/>}
    {tab==='transitions'&&<CharacterTransitions characters={characters} role={profile.role} userId={profile.id} onRefresh={load}/>}
    {tab==='settings'&&<FCSettings role={profile.role}/>}
    {disabledInfo[tab]&&<section className="panel"><h2>{disabledInfo[tab][0]}</h2><p>{disabledInfo[tab][1]}</p></section>}
   </div>
  </main>
 </div>;
}
