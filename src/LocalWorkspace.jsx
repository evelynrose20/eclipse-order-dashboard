import React,{useEffect,useState} from 'react';
import {ACCOUNT_ROLES} from './OrderSheets.jsx';
import Encounters from './Encounters.jsx';
import PlayerBattleView from './PlayerBattleView.jsx';
import EventBoard from './EventBoard.jsx';
import {CharacterTransitions} from './RPPlatform.jsx';
import {ProfileConsent} from './ProfileConsent.jsx';
import {MemberRPDirectory} from './MemberRPDirectory.jsx';
import FCSettings from './FCSettings.jsx';
import Factions from './Factions.jsx';
import WorldAdministration from './WorldAdministration.jsx';
import Workshop from './Workshop.jsx';
import TradeWorkspace from './TradeWorkspace.jsx';
import InternalRail from './InternalRail.jsx';
import Treasury from './Treasury.jsx';
import Fronts from './Fronts.jsx';
import ThrallChamber from './ThrallChamber.jsx';
import ConstructionProjects from './ConstructionProjects.jsx';
import DiscordAccountConnection from './DiscordAccountConnection.jsx';
import InlineSheetEditor from './InlineSheetEditor.jsx';


import CharacterDossier from './CharacterDossier.jsx';
import GovernancePreview from './GovernancePreview.jsx';
import LoreArchive from './LoreArchive.jsx';
import OrderNavigation,{getNavSection} from './OrderNavigation.jsx';
import './dashboard.css';
import './local-accounts.css';
import './portal-controls.css';
import './imperial-theme.css';

const memberIdentity=member=>{
 const label=String(member?.discord_username||member?.display_name||'').trim();
 return label&&!/^discord-\d+@members\.eclipse\.invalid$/i.test(label)?label:'Order member';
};
const memberMonogram=memberIdentityValue=>memberIdentityValue.trim().split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()||'').join('')||'EO';
const primaryOrderRank=profile=>['leadership','snakes','fangs','golden_claws','household','membership']
 .map(track=>profile?.order_rank_titles?.[track]).find(Boolean)||'Order member';
const ROLE_OPTIONS=['member','handler','high_command','domina'];
const field=(label,value,update)=> <label className="field"><span>{label}</span><input value={value??''} onChange={e=>update(e.target.value)}/></label>;
const canManage=role=>role==='domina'||role==='high_command';
const newSheet=()=>({name:'',player:'',owner:'',specialty:'',notes:'',rank:'Unbound: Free',collar_bound:false,
 hp:10,max_hp:10,armor_class:10,level:1,experience:0,class_id:'',class_name:'',species:'',str:10,dex:10,con:10,int:10,wis:10,cha:10});
export default function LocalWorkspace({profile,request,onLogout}){
 const [tab,setTab]=useState('overview');
 const [constructionEventId,setConstructionEventId]=useState('');
 const [menuOpen,setMenuOpen]=useState(false);
 const [members,setMembers]=useState([]);
 const [rankCatalog,setRankCatalog]=useState([]);
 const [characters,setCharacters]=useState([]);
 const [selected,setSelected]=useState('');
 const [draft,setDraft]=useState(null);
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const [chamberAccess,setChamberAccess]=useState(false);
 const [filter,setFilter]=useState('');
 const [classCatalog,setClassCatalog]=useState({});
 const reloadClasses=async()=>{const result=await request('/classes');setClassCatalog(result.classes||{})};
 const staff=['domina','high_command','handler'].includes(profile.role);
 const [playerPreview,setPlayerPreview]=useState(false);
 const changeView=()=>{setMenuOpen(false);setPlayerPreview(v=>!v);setTab('overview');setDraft(null);setSelected('');setFilter('');setMessage('')};
 const load=async()=>{
  const roster=await request('/characters');
  setCharacters(roster);
  setSelected(old=>old&&roster.some(c=>c.id===old)?old:roster[0]?.id||'');
  if(profile.role==='domina'){
   const [accounts,catalog]=await Promise.all([request('/admin/accounts'),request('/admin/order-ranks')]);
   setMembers(accounts);setRankCatalog(catalog.ranks||[]);
  }
 };
 useEffect(()=>{load().catch(err=>setMessage(err.message));reloadClasses().catch(err=>setMessage(err.message))},[profile.id]);
 useEffect(()=>{
  let active=true;
  setChamberAccess(false);
  request('/thralls/chamber').then(()=>{if(active)setChamberAccess(true)}).catch(()=>{if(active)setChamberAccess(false)});
  return()=>{active=false};
 },[profile.id]);
 useEffect(()=>{if(tab==='chamber'&&!chamberAccess)setTab('overview')},[tab,chamberAccess]);
 const pending=members.filter(m=>m.approval_status==='pending');
 const active=members.filter(m=>m.approval_status==='approved');
 const visibleCharacters=playerPreview?characters.filter(c=>c.player_user_id===profile.id):characters;
 const character=visibleCharacters.find(c=>c.id===selected)||visibleCharacters[0];
 const admin=!playerPreview&&canManage(profile.role);
 const navigation=[
  ['overview','Overview','◈'],
  ['roster','Character roster','▦'],
  ['sheet','Character dossiers','◇'],
  ...(!playerPreview&&profile.role==='domina'?[['members','Order accounts','♛']]:[]),
  ...(!playerPreview?[['governance','Governance','♛']]:[]),
  ['encounters','Encounters & dice','⚄'],
  ['events','Events & signups','◷'],
  // Existing event-linked construction campaigns remain accessible from Events.
  // Industry & Projects is the sole permanent construction navigation entry.
  ['factions','Factions & diplomacy','✧'],
  ['world','World Administration','▧'],
  ['lore','Order Chronicles','✦'],
  ['workshop','Workshop & Garden','♧'],
  ['trade','Trade Routes','♜'],
  ...(!playerPreview&&canManage(profile.role)?[['internal-rail','Internal Rail Logistics','🚆']]:[]),
  ['fronts','Order Fronts','♛'],
  ...(chamberAccess?[['chamber','Extraction Chamber','◇']]:[]),
  ['treasury','Order Treasury','◈'],
  ['profile','My RP preferences','♡'],
  ['directory','Member RP profiles','♧'],
  ['transitions','Binding requests','◇'],
  ['settings','Order rules','⚙']
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
   // Handler assignment is a separate Order duty. Account ownership is never edited here.
   const original=form.id?characters.find(c=>c.id===form.id):null;
   if(admin&&original&&original.handler_user_id!==form.handler_user_id){
    await request('/characters/'+id+'/assign',{method:'POST',body:{
     player_user_id:original.player_user_id||null,handler_user_id:form.handler_user_id||null
    }});
   }

   setDraft(null);await load();
   if(created.id)setSelected(created.id);
   setMessage('Character sheet saved.');
  }catch(err){setMessage(err.message)}
  finally{setBusy(false)}
 };
 return <div className="app-shell eo-local">
  <OrderNavigation items={navigation} active={tab} mode={playerPreview?'member':'staff'} open={menuOpen} onClose={()=>setMenuOpen(false)} onNavigate={id=>{setTab(id);setDraft(null);setMessage('')}} footer={<div className="side-bottom"><div className="monogram" aria-hidden="true">{memberMonogram(memberIdentity(profile))}</div><div className="side-identity"><strong title={memberIdentity(profile)}>{memberIdentity(profile)}</strong><small>{primaryOrderRank(profile)}</small></div></div>}/>
  <main className="main">
   <header className="topbar"><button type="button" className="order-nav-menu" aria-label="Open navigation" aria-expanded={menuOpen} onClick={()=>setMenuOpen(true)}>☰</button><div className="breadcrumb">{getNavSection(tab)} <span>/</span> {navigation.find(n=>n[0]===tab)?.[1]}</div><div className="top-actions">{staff&&<button type="button" className={'view-switch '+(playerPreview?'preview-active':'')} aria-pressed={playerPreview} onClick={changeView}>{playerPreview?'Return to staff view':'Preview player view'}</button>}<span className="local-status"><span className="pulse"/> Ledger available</span><button className="mini-btn" onClick={onLogout}>Sign out</button></div></header>
   <div className={"content"+(tab==='encounters'?" encounter-content":"")}>
    {playerPreview&&<div className="player-preview-banner" role="status"><strong>Player View · Read-only preview</strong><span>Showing member navigation and your own linked characters. Your staff login and server permissions are unchanged; use a separate member account to verify real access restrictions.</span></div>}
    {tab!=='encounters'&&<div className="page-intro"><div><div className="eyebrow">{playerPreview?'MEMBER PORTAL':'ORDER OPERATIONS'}</div><h1>{navigation.find(n=>n[0]===tab)?.[1]}</h1><p>{tab==='overview'?(playerPreview?'Your character records, events and RP profile at a glance.':'Your Order at a glance.'):tab==='members'?'Approve membership requests; manage syndicate ranks and separate account permissions.':tab==='chamber'?'Operate the permanent magitek installation and maintain its collection and alchemical records.':'Manage the Order’s records and activities.'}</p></div></div>}
    {message&&<div className="alert" role="status">{message}</div>}
    {tab==='overview'&&<>
     <div className="eo-summary"><div><strong>{visibleCharacters.length}</strong><span>Visible characters</span></div>{!playerPreview&&profile.role==='domina'&&<div><strong>{pending.length}</strong><span>Pending accounts</span></div>}{!playerPreview&&<div><strong>{active.length||(profile.role==='domina'?0:'—')}</strong><span>Approved members</span></div>}</div>
     {!playerPreview&&<DiscordAccountConnection request={request}/>}
     <section className="panel"><h2>Welcome, {profile.display_name}</h2><p><strong>Order standing:</strong> {primaryOrderRank(profile)} · <strong>Website access:</strong> {ACCOUNT_ROLES[profile.role]?.label||profile.role}</p><p>The Order’s records, events, and character dossiers are available to you here.</p></section>
    </>}
    {tab==='members'&&!playerPreview&&profile.role==='domina'&&<>
     <div className="eo-toolbar"><h2>Pending membership requests ({pending.length})</h2><button className="btn secondary" onClick={()=>load().catch(err=>setMessage(err.message))}>Refresh</button></div>
     {!pending.length?<div className="panel"><p>No pending account requests.</p></div>:pending.map(m=><article className="eo-member" key={m.user_id}><div><strong>{m.display_name}</strong><small>{memberIdentity(m)}</small><span>Requested {new Date(m.created_at).toLocaleDateString()}</span></div><div className="eo-actions"><button className="eo-primary" disabled={busy} onClick={()=>act(m.user_id,'approve')}>Approve</button><button disabled={busy} onClick={()=>{if(window.confirm('Reject this membership request?'))act(m.user_id,'reject')}}>Reject</button></div></article>)}
     <h2 className="eo-member-title">Approved accounts</h2><p className="muted">Syndicate rank reflects a member's place in the Order. Access permissions govern staff duties, while binding ranks belong to individual characters.</p>
     {active.map(m=><article className="eo-member" key={m.user_id}><div><strong>{memberIdentity(m)}</strong><small>{m.role==='domina'?'Order leadership':'Order member'}</small></div><div className="eo-actions"><label>Website access<select value={m.role} disabled={busy||m.user_id===profile.id} onChange={e=>act(m.user_id,'role',{role:e.target.value})}>{ROLE_OPTIONS.map(role=><option value={role} key={role}>{ACCOUNT_ROLES[role]?.label||role}</option>)}</select></label>{['leadership','membership','snakes','fangs','golden_claws','household'].map(track=><label key={track}>{({leadership:'Order leadership',membership:'Membership standing',snakes:'The Snakes',fangs:'The Fangs',golden_claws:'The Golden Claws',household:'The Household'})[track]}<select value={m.order_ranks?.[track]||''} disabled={busy||m.user_id===profile.id} onChange={e=>act(m.user_id,'order-rank',{track,code:e.target.value})}><option value="">Not assigned</option>{rankCatalog.filter(r=>r.track===track).map(r=><option value={r.code} key={r.code}>{r.title}</option>)}</select></label>)}</div></article>)}
    </>}
    {tab==='roster'&&<>
     <div className="eo-toolbar"><h2>Character records</h2>{admin&&<button className="btn primary" onClick={()=>{setDraft(newSheet());setTab('sheet')}}>+ Create character</button>}</div>
     <input className="eo-search" placeholder="Search characters…" aria-label="Search characters" value={filter} onChange={e=>setFilter(e.target.value)}/>
     {!visibleCharacters.length?<section className="panel"><h3>No characters yet</h3><p>No characters have been added to the Order's roster yet.</p></section>:<div className="eo-character-grid">{visibleCharacters.filter(c=>[c.name,c.player,c.specialty].join(' ').toLowerCase().includes(filter.toLowerCase())).map(c=><button key={c.id} className="eo-character" onClick={()=>{setSelected(c.id);setTab('sheet')}}><strong>{c.name}</strong><span>{c.rank}</span><small>{c.class_name||'No class set'} · {c.view_mode==='bound'?'Restricted sheet':'Full sheet'}</small></button>)}</div>}
    </>}
    {tab==='sheet'&&<>
     <div className="eo-toolbar"><h2>Character sheets</h2>{admin&&<button className="btn primary" onClick={()=>setDraft(newSheet())}>+ New sheet</button>}</div>
     {visibleCharacters.length>0&&<select className="eo-sheet-picker" value={character?.id||''} onChange={e=>{setSelected(e.target.value);setDraft(null)}}>{visibleCharacters.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select>}
     {draft?<InlineSheetEditor key={draft.id||'new'} character={draft} classCatalog={classCatalog} canCommand={admin} members={members} userId={profile.id} onSave={save} onCancel={()=>setDraft(null)} saving={busy}/>:
     character?<CharacterDossier key={character.id} character={character} playerPreview={playerPreview} canEdit={!playerPreview&&character.view_mode==='full'&&(admin||profile.role==='handler'||(!character.collar_bound&&character.player_user_id===profile.id))} onEdit={()=>setDraft({...character})} onOpenPreferences={()=>setTab('profile')} canCommand={admin} request={request} onRefresh={load} classCatalog={classCatalog} userId={profile.id}/>:
     <section className="panel"><h3>No character selected</h3><p>Create a character to get started.</p></section>}
    </>}
    {tab==='lore'&&<LoreArchive request={request} admin={!playerPreview}/>}
    {tab==='governance'&&!playerPreview&&<GovernancePreview currentUser={profile} request={request} accounts={members}/>}
    {tab==='treasury'&&<Treasury request={request} characters={visibleCharacters.filter(c=>(c.player_user_id||c.player_account_id)===profile.id)} canManage={canManage(profile.role)} readOnly={playerPreview}/>}
    {tab==='chamber'&&chamberAccess&&<ThrallChamber request={request}/>}
    {tab==='fronts'&&<Fronts request={request} characters={visibleCharacters} userId={profile.id} canManage={canManage(profile.role)||['gilded_talon','high_claw'].includes(profile.order_ranks?.golden_claws)} canApproveSite={canManage(profile.role)} readOnly={playerPreview}/>}
    {tab==='internal-rail'&&admin&&<InternalRail request={request}/>}
    {tab==='trade'&&<TradeWorkspace request={request} characters={visibleCharacters.filter(c=>(c.player_user_id||c.player_account_id)===profile.id)} canManage={canManage(profile.role)} readOnly={playerPreview}/>}
    {tab==='workshop'&&<Workshop request={request} characters={visibleCharacters.filter(c=>(c.player_user_id||c.player_account_id)===profile.id)} canManage={canManage(profile.role)} readOnly={playerPreview}/>}
    {tab==='factions'&&<Factions request={request} canEdit={canManage(profile.role)} previewOnly={playerPreview}/>}
    {tab==='world'&&<WorldAdministration userId={profile.id} characters={visibleCharacters} request={request} readOnly={playerPreview}/> }
    {tab==='construction'&&<ConstructionProjects key={constructionEventId||'all'} request={request} characters={visibleCharacters} userId={profile.id} canManage={staff} readOnly={playerPreview} initialEventId={constructionEventId}/>}
    {tab==='events'&&<EventBoard key={playerPreview?'preview-events':'member-events'} request={request} onOpenConstruction={id=>{setConstructionEventId(id);setTab('construction')}} userId={profile.id} characters={visibleCharacters} onOpenProfile={()=>setTab('profile')} previewOnly={playerPreview} isStaff={staff}/>}
    {tab==='encounters'&&(playerPreview||!staff?<PlayerBattleView key={playerPreview?'preview-battle':'member-battle'}/>:<Encounters classCatalog={classCatalog} key="dm-studio" role={profile.role} userId={profile.id} characters={visibleCharacters} onOpenProfile={()=>setTab('profile')} onRefreshCharacters={load}/>)}
    {tab==='profile'&&<><DiscordAccountConnection request={request} readOnly={playerPreview}/><ProfileConsent readOnly={playerPreview}/></>}
    {tab==='directory'&&<MemberRPDirectory/>}
    {tab==='transitions'&&<CharacterTransitions key={playerPreview?'player':'staff'} readOnly={playerPreview} characters={visibleCharacters} role={playerPreview?'member':profile.role} userId={profile.id} onRefresh={load}/>}
    {tab==='settings'&&<FCSettings role={playerPreview?'member':profile.role} request={request}/>}
   </div>
  </main>
 </div>;
}
