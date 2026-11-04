import React, { useEffect, useMemo, useRef, useState } from 'react';
import { INITIAL_SLAVES, RANKS, SHOP_ITEMS } from './data/initialData.js';
import './dashboard.css';
import './shared-login.css';
import {configured,currentSession,signIn,signOut,loadSharedCharacters,saveSharedCharacter,removeSharedCharacter,importSharedCharacters,loadMyRole,loadOrderMembers,updateOrderMemberRole,updateOrderMemberStanding} from './supabase.js';
import {FullDndSheet,LimitedSheet,MemberDirectory,ACCOUNT_ROLES} from './OrderSheets.jsx';
import {CharacterTransitions} from './RPPlatform.jsx';
import Encounters from './Encounters.jsx';
import {ProfileConsent} from './ProfileConsent.jsx';
import FCSettings from './FCSettings.jsx';
import InlineSheetEditor from './InlineSheetEditor.jsx';
import {MemberRPDirectory} from './MemberRPDirectory.jsx';

const KEY = 'eclipse-order-ledger-v3';
const NAV = [['overview','Overview','◈'],['roster','Character roster','▦'],['sheet','Character sheets','◇'],['market','Black Market','◆'],['settings','Workspace & backup','⚙'],['members','Order accounts','♛'],['scenes','Encounters & dice','⚄'],['profile','My RP profile','♡'],['directory','Member RP profiles','♧'],['transitions','Binding requests','◇']];
const STATS = ['str','dex','con','int','wis','cha'];
const RANK_KEYS = Object.keys(RANKS);
const OLD_RANKS = {
  'Rank I: Unbroken':'Rank I: Fresh Intake / Unbroken',
  'Rank II: Indentured':'Rank II: Initiate / Indentured',
  'Rank III: Specialized':'Rank III: Trusted / Specialized',
  'Rank IV: Elite':'Rank IV: Elite / Favor of the Domina'
};
const canonicalRank = rank => OLD_RANKS[rank] || rank;
const BOUND_RANKS = Object.keys(RANKS).filter(k=>k!=='Unbound: Free');

const glyph = (value) => String(value || '').slice(0, 1).toUpperCase() || '?';
const gil = (n) => Math.max(0, Number(n) || 0).toLocaleString('en-US');
const safeNumber = (n, fallback = 0, min = 0, max = 999999999) => Number.isFinite(Number(n)) ? Math.min(max, Math.max(min, Number(n))) : fallback;
const normalize = (r, index) => ({
  ...r,
  id: String(r.id ?? 'import-' + index), name: String(r.name || 'Unnamed character').slice(0, 80),
  player: String(r.player || '@Unknown').slice(0, 80), owner: String(r.owner || 'Unassigned').slice(0, 80),
  specialty: String(r.specialty || 'Unassigned').slice(0, 100),
  rank: RANKS[canonicalRank(r.rank)] ? canonicalRank(r.rank) : (r.collar_bound ? BOUND_RANKS[0] : 'Unbound: Free'), notes: String(r.notes || '').slice(0, 4000),
  hp: safeNumber(r.hp, 20), gil: safeNumber(r.gil),
  collar_bound: r.collar_bound === undefined ? r.rank !== 'Unbound: Free' : r.collar_bound === true,
  level: safeNumber(r.level,1,1,20), max_hp:safeNumber(r.max_hp,r.hp||20),
  armor_class:safeNumber(r.armor_class,10,0,40), speed:safeNumber(r.speed,30,0,200),
  proficiency_bonus:safeNumber(r.proficiency_bonus,2,0,10), temp_hp:safeNumber(r.temp_hp,0),
  ...Object.fromEntries(STATS.map(k => [k, safeNumber(r[k], 10, 1, 30)])),
});
function readLedger() {
  try {
    for (const key of [KEY, 'fc_slaves_modular', 'fc_slaves']) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const value = JSON.parse(raw);
      const records = Array.isArray(value) ? value : value?.characters;
      if (Array.isArray(records)) return records.map(normalize);
    }
  } catch (e) { console.warn('Ledger could not be loaded', e); }
  return INITIAL_SLAVES.map(normalize);
}
const fresh = () => ({name:'',player:'',owner:'',specialty:'',rank:'Unbound: Free',collar_bound:false,player_user_id:'',handler_user_id:'',hp:20,max_hp:20,temp_hp:0,armor_class:10,speed:30,hit_dice:'1d8',level:1,class_name:'',species:'',background:'',alignment:'',experience:0,proficiency_bonus:2,features:'',spells:'',inventory:'',proficiencies:'',conditions:'',personality:'',ideals:'',bonds:'',flaws:'',saving_throws:{},skills:{},gil:0,notes:'',str:10,dex:10,con:10,int:10,wis:10,cha:10});
function rankIndex(rank) { return Math.max(0, RANK_KEYS.indexOf(rank)); }
function downloadFile(name, content) {
  const url = URL.createObjectURL(new Blob([content], {type:'application/json'}));
  const anchor = document.createElement('a'); anchor.href=url; anchor.download=name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Field({label,children}) { return <label className="field"><span>{label}</span>{children}</label>; }
function RankTag({rank}) { return <span className={'rank-tag rank-' + rankIndex(rank)}>{rank.replace(': ', ' · ')}</span>; }
function Empty({title,detail}) { return <div className="empty"><div className="empty-icon">◇</div><h3>{title}</h3><p>{detail}</p></div>; }

export default function Dashboard() {
  const [characters,setCharacters] = useState(()=>configured?[]:readLedger());
  const [session,setSession] = useState(()=>configured?currentSession():null);
  const refreshCharacters = async()=>{if(configured)setCharacters((await loadSharedCharacters()).map(normalize));};
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [loginError,setLoginError] = useState('');
  const [loading,setLoading] = useState(configured);
  const [remoteError,setRemoteError] = useState('');
  const [syncStatus,setSyncStatus] = useState(configured?'Sign in required':'Browser-saved');
  const [accountRole,setAccountRole] = useState(configured?null:'domina');
  const [members,setMembers] = useState([]);
  const canCommand = accountRole==='domina'||accountRole==='high_command';
  const canCreate = canCommand;
  const canHandle = accountRole==='handler';
  const canEdit = c => Boolean(c && (canCommand || (canHandle&&c.handler_user_id===session?.user?.id) || (accountRole==='member'&&c.player_user_id===session?.user?.id&&!c.collar_bound)));
  const availableNav=NAV.filter(([id])=>(id!=='members'||['domina','high_command'].includes(accountRole))&&(configured||!['scenes','profile','directory','transitions'].includes(id)));
  const [tab,setTab] = useState('overview');
  const [search,setSearch] = useState('');
  const [rankFilter,setRankFilter] = useState('all');
  const [rosterGroup,setRosterGroup] = useState('free');
  const [selectedId,setSelectedId] = useState(null);
  const [editor,setEditor] = useState(null);
  const [sheetSaving,setSheetSaving] = useState(false);
  const [roll,setRoll] = useState(null);
  const [rollStat,setRollStat] = useState('str');
  const [diceSides,setDiceSides] = useState(20);
  const [marketFilter,setMarketFilter] = useState('all');
  const [notice,setNotice] = useState('');
  const [saveError,setSaveError] = useState('');
  const importRef = useRef(null);
  useEffect(() => {
    if(configured) return;
    try { localStorage.setItem(KEY,JSON.stringify({version:3,characters}));setSaveError(''); }
    catch {setSaveError('Browser storage is unavailable or full. Export a backup to avoid data loss.');}
  },[characters]);
  useEffect(()=>{
    if(!configured||!session){setLoading(false);return;}
    let active=true;
    async function refresh(){
      try{
        const [role,rows]=await Promise.all([loadMyRole(),loadSharedCharacters()]);
        const people=['domina','high_command'].includes(role)?await loadOrderMembers():[];
        if(active){setAccountRole(role);setMembers(people);setCharacters(rows.map(normalize));setRemoteError('');setSyncStatus('Shared ledger connected');setLoading(false);}
      }catch(error){if(active){setRemoteError(error.message);setSyncStatus('Connection error');setLoading(false);}}
    }
    refresh();
    const timer=setInterval(refresh,30000);
    return ()=>{active=false;clearInterval(timer);};
  },[session]);
  async function login(e){
    e.preventDefault();setLoginError('');
    try{const next=await signIn(email.trim(),password);setSession(next);setPassword('');setLoading(true);}
    catch(error){setLoginError(error.message);}
  }
  function logout(){signOut();setSession(null);setCharacters([]);setMembers([]);setAccountRole(null);setRemoteError('');setSyncStatus('Signed out');}
  async function changeMemberStanding(member,standing){
    try{await updateOrderMemberStanding(member.user_id,standing);setMembers(await loadOrderMembers());warn('Member standing updated.');}
    catch(error){warn('Standing change failed: '+error.message);}
  }
  async function changeMemberRole(member,newRole){
    if(!window.confirm('Change '+member.email+' to '+(ACCOUNT_ROLES[newRole]?.label||newRole)+'?'))return;
    try{await updateOrderMemberRole(member.user_id,newRole);setMembers(await loadOrderMembers());warn('Account role updated.');}
    catch(error){warn('Role change failed: '+error.message);}
  }
  useEffect(() => {if (!selectedId || !characters.some(c=>c.id===selectedId)) setSelectedId(characters[0]?.id ?? null);},[characters,selectedId]);
  const selected = characters.find(c=>c.id===selectedId) || null;
  const filtered = useMemo(() => characters.filter(c => Boolean(c.collar_bound)===(rosterGroup==='bound') && (rankFilter==='all' || c.rank===rankFilter) && [c.name,c.player,c.owner,c.specialty].join(' ').toLowerCase().includes(search.toLowerCase())).sort((a,b)=>a.name.localeCompare(b.name)),[characters,rankFilter,search,rosterGroup]);
  const totalGil = characters.reduce((a,c)=>a+c.gil,0);
  const topRank = characters.filter(c=>c.collar_bound && ['Rank III: Trusted / Specialized','Rank IV: Elite / Favor of the Domina'].includes(c.rank)).length;
  const warn = message => {setNotice(message);window.setTimeout(()=>setNotice(''),4200);};
  async function saveCharacter(e, candidate=editor) {
    e.preventDefault();
    if (!candidate?.name.trim() || (!canCreate&&!canEdit(candidate))) return;
    const isNew=!candidate.id;
    const id=candidate.id || (globalThis.crypto?.randomUUID?.() || String(Date.now()));
    const record=normalize({...candidate,id,name:candidate.name.trim()},0);
    if (canCommand && record.collar_bound && record.rank==='Unbound: Free') record.rank='Rank I: Fresh Intake / Unbroken';
    if (configured && isNew && record.collar_bound && record.player_user_id) {warn('Create the linked character unbound, then request their OOC-approved binding.');return;}
    if (canCommand && !record.collar_bound) record.rank='Unbound: Free';
    if (configured && !isNew && Boolean(candidate.collar_bound)!==Boolean(characters.find(c=>c.id===id)?.collar_bound)){warn('Binding changes require a separate player-approved request under Binding requests.');return;}
    if(configured){try{setSheetSaving(true);await saveSharedCharacter(record);}catch(error){warn('Save failed: '+error.message);return;}finally{setSheetSaving(false)}}
    setCharacters(old => isNew ? [record,...old] : old.map(c=>c.id===id?record:c));
    setSelectedId(id);setEditor(null);setTab('sheet');warn(isNew?'Character added to this browser.':'Character changes saved.');
  }
  async function removeCharacter(c) {
    if(!canCommand)return;
    if (!window.confirm('Permanently remove '+c.name+' from the Order ledger? Export a backup first if needed.')) return;
    if(configured){try{await removeSharedCharacter(c.id);}catch(error){warn('Delete failed: '+error.message);return;}}
    setCharacters(old=>old.filter(x=>x.id!==c.id));setEditor(null);warn('Character removed.');
  }
  async function changeRank(c,newRank){
    if(!canCommand||!c.collar_bound||!BOUND_RANKS.includes(newRank))return;
    if(configured){try{await saveSharedCharacter({...c,rank:newRank});}catch(error){warn('Rank update failed: '+error.message);return;}}
    setCharacters(old=>old.map(x=>x.id===c.id?{...x,rank:newRank}:x));warn(configured?'Rank saved to shared ledger.':'Rank updated locally.');
  }
  function doRoll() {
    if (!selected) return;
    const raw=Math.floor(Math.random()*diceSides)+1;
    const statMod=Math.floor((selected[rollStat]-10)/2);
    const rankMod=RANKS[selected.rank]?.mod || 0;
    setRoll({raw,statMod,rankMod,total:raw+statMod+rankMod,sides:diceSides,stat:rollStat.toUpperCase()});
  }
  async function importBackup(e) {
    if(!canCommand)return;
    const file=e.target.files?.[0]; if (!file) return;
    try {
      if (file.size > 2000000) throw Error('Backup file is too large (maximum 2 MB).');
      const parsed=JSON.parse(await file.text());
      const records=Array.isArray(parsed)?parsed:parsed.characters;
      if (!Array.isArray(records) || records.length>5000) throw Error('Expected a JSON ledger with up to 5,000 characters.');
      const cleaned=records.filter(c=>c && typeof c==='object' && !Array.isArray(c)).map(normalize);
      const ids=new Set();
      cleaned.forEach((c,i)=>{if(ids.has(c.id))c.id=c.id+'-'+i;ids.add(c.id);});
      if(configured){
        if(!window.confirm('Add or update '+cleaned.length+' shared characters? Existing matching IDs will be overwritten.'))return;
        await importSharedCharacters(cleaned);
        setCharacters((await loadSharedCharacters()).map(normalize));setRoll(null);warn('Shared backup imported.');
      }else{
        if(!window.confirm('Replace the current local ledger with '+cleaned.length+' imported characters? Export your existing ledger first.'))return;
        setCharacters(cleaned);setRoll(null);warn('Backup imported successfully.');
      }
    } catch(err) {warn('Import failed: '+err.message);}
    finally {e.target.value='';}
  }
  async function migrateLocal(){
    if(!canCommand)return;
    const found=[KEY,'fc_slaves_modular','fc_slaves'].some(key=>localStorage.getItem(key));
    if(!found){warn('No saved browser ledger found to migrate.');return;}
    const records=readLedger();
    if(!window.confirm('Upload '+records.length+' browser-saved records into the SHARED ledger? Matching character IDs will be updated.'))return;
    try{await importSharedCharacters(records);setCharacters((await loadSharedCharacters()).map(normalize));warn('Browser records migrated to shared storage.');}
    catch(error){warn('Migration failed: '+error.message);}
  }
  const actions=<>{canCreate&&<button className="btn secondary" onClick={()=>setEditor(fresh())}>+ New character</button>}{canCommand&&<button className="btn primary" onClick={()=>{downloadFile('eclipse-order-ledger-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify({version:4,exportedAt:new Date().toISOString(),characters},null,2));warn('Backup downloaded.');}}>↓ Export backup</button>}</>;
  if(configured&&!session)return <div className="login-screen"><form className="login-card" onSubmit={login}>
    <div className="brand"><span className="brand-sigil">✦</span><div><strong>ECLIPSE ORDER</strong><small>MEMBER ACCESS</small></div></div>
    <h1>Enter the Order</h1><p>Sign in with an approved member account to access the shared ledger.</p>
    {loginError&&<div className="alert" role="alert">{loginError}</div>}
    <Field label="EMAIL ADDRESS"><input required type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}/></Field>
    <Field label="PASSWORD"><input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></Field>
    <button className="btn primary" type="submit">Sign in</button><small>Ask an administrator to provision your account.</small>
  </form></div>;
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-sigil">✦</span><div><strong>ECLIPSE ORDER</strong><small>THE UNDERWORLD LEDGER</small></div></div>
      <div className="workspace-chip"><span className="pulse"/> {configured?'Shared workspace':'Local workspace'} <small>{configured?'Supabase database':'Private to this browser'}</small></div>
      <p className="nav-label">COMMAND CENTER</p>
      <nav aria-label="Primary navigation">{availableNav.map(([id,label,symbol])=><button key={id} className={'nav-link '+(tab===id?'active':'')} onClick={()=>{setTab(id);setEditor(null);}}><span className="nav-symbol">{symbol}</span>{label}</button>)}</nav>
      <div className="side-bottom"><div className="monogram">EO</div><div><strong>{ACCOUNT_ROLES[accountRole]?.label||'Member session'}</strong><small>{configured?(session?.user?.email||'Authenticated'):'No account authentication'}</small></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="breadcrumb">ECLIPSE ORDER <span>/</span> {availableNav.find(x=>x[0]===tab)?.[1] || 'Dashboard'}</div><div className="top-actions"><span className="local-status"><span className="pulse"/> {syncStatus}</span>{configured&&<button className="mini-btn" onClick={logout}>Sign out</button>}<button className="icon-button" title="Open workspace settings" aria-label="Open workspace settings" onClick={()=>setTab('settings')}>⚙</button></div></header>
      <div className="content">
        <div className="page-intro"><div><div className="eyebrow">ORDER OPERATIONS <span className="eyebrow-line"/></div><h1>{tab==='overview'?'Command overview':NAV.find(x=>x[0]===tab)?.[1]}</h1><p>{({overview:'The ledger at a glance. Manage your roster, ranks and records.',roster:'Search and administer every character in the ledger.',sheet:'Character details, attributes and tabletop dice checks.',market:'Browse the Black Market catalogue and rank allowances.',settings:'Manage browser storage, backups and workspace safety.',members:'Manage command hierarchy, handlers, and member account roles.',scenes:'Run D&D-style encounters, initiative, combat and shared dice.',profile:'Control your OOC content preferences, kink lists and what other members can see.',directory:'Browse members who have chosen to share their RP profiles.',transitions:'Request and approve voluntary changes between free and magically bound status.'})[tab]}</p></div><div className="intro-actions">{actions}</div></div>
        {saveError && <div className="alert" role="alert">{saveError}</div>}
        {remoteError && <div className="alert" role="alert">{remoteError} — Verify your Supabase membership and schema.</div>}
        {loading && <div className="alert" role="status">Loading shared character records…</div>}
        {notice && <div className="toast" role="status">{notice}</div>}
        {tab==='overview' && <><div className="stat-grid">
          <div className="stat-card"><small>REGISTERED CHARACTERS</small><b>{characters.length}</b><span>In this ledger</span><div className="card-mark">◇</div></div>
          <div className="stat-card"><small>ADVANCED RANKS</small><b>{topRank}</b><span>Rank III and IV</span><div className="card-mark">✦</div></div>
          <div className="stat-card"><small>TOTAL RECORDED GIL</small><b>{gil(totalGil)}</b><span>Combined character balances</span><div className="card-mark">◆</div></div>
          <div className="stat-card"><small>RANK TIERS</small><b>{RANK_KEYS.length}</b><span>Configured privileges</span><div className="card-mark">▤</div></div>
        </div><div className="overview-grid"><section className="panel"><div className="panel-heading"><div><h2>Recent roster</h2><p>Quick access to character records</p></div><button className="text-button" onClick={()=>setTab('roster')}>View all →</button></div>{characters.length?characters.slice(0,5).map(c=><button key={c.id} className="character-row" onClick={()=>{setSelectedId(c.id);setTab('sheet');}}><span className="avatar">{glyph(c.name)}</span><span className="character-name"><strong>{c.name}</strong><small>{c.player} · {c.specialty}</small></span><RankTag rank={c.rank}/><span className="row-arrow">›</span></button>):<Empty title="Your roster is empty" detail="Create a character to get started."/>}</section><section className="panel"><div className="panel-heading"><div><h2>Rank distribution</h2><p>Breakdown of the active ledger</p></div></div><div className="distribution">{RANK_KEYS.map((key,i)=>{const count=characters.filter(c=>c.rank===key).length;return <div className="dist-item" key={key}><div className="dist-head"><span className={'rank-dot rank-bg-'+i}/><span>{key}</span><strong>{count}</strong></div><div className="track"><span className={'fill rank-bg-'+i} style={{width:(characters.length?count/characters.length*100:0)+'%'}}/></div></div>})}</div><div className="hint-box"><strong>Workspace notice</strong><p>{configured?'Approved members share these records. Updates refresh from Supabase every 30 seconds.':'This is a local roleplay record manager, not a secure shared service. Data and changes stay in this browser until you export them.'}</p></div></section></div></>}
        {tab==='roster' && <section className="panel"><div className="panel-heading wrap"><div><h2>Character roster</h2><p>Free members and magically bound characters have separate lists. Changing status uses Binding requests, not the rank dropdown.</p></div></div>
        <div className="roster-switch" role="tablist" aria-label="Roster group">
          <button role="tab" aria-selected={rosterGroup==='free'} className={'roster-tab '+(rosterGroup==='free'?'active':'')} onClick={()=>{setRosterGroup('free');setRankFilter('all')}}>Free members <span>{characters.filter(c=>!c.collar_bound).length}</span></button>
          <button role="tab" aria-selected={rosterGroup==='bound'} className={'roster-tab '+(rosterGroup==='bound'?'active':'')} onClick={()=>{setRosterGroup('bound');setRankFilter('all')}}>Bound characters <span>{characters.filter(c=>c.collar_bound).length}</span></button>
        </div>
        <div className="roster-toolbar"><div><strong>{rosterGroup==='bound'?'Bound character registry':'Free member directory'}</strong><p>{rosterGroup==='bound'?'Ranks I–IV; full sheets remain available only to authorized staff.':'Unbound characters are listed here regardless of their FC account standing.'}</p></div><div className="filters"><input aria-label="Search roster" placeholder="Search characters or players" value={search} onChange={e=>setSearch(e.target.value)}/>{rosterGroup==='bound'&&<select aria-label="Filter slave rank" value={rankFilter} onChange={e=>setRankFilter(e.target.value)}><option value="all">All bound ranks</option>{BOUND_RANKS.map(k=><option value={k} key={k}>{k}</option>)}</select>}</div></div>
        <div className="table-scroll"><table><thead><tr><th>CHARACTER</th><th>{rosterGroup==='bound'?'HANDLER':'ASSIGNED TO'}</th><th>{rosterGroup==='bound'?'BOUND RANK':'STATUS'}</th><th>GIL</th><th>MANAGE</th></tr></thead>
        <tbody>{filtered.map(c=><tr key={c.id}><td><div className="table-identity"><span className="avatar">{glyph(c.name)}</span><span><strong>{c.name}</strong><small>{c.player} · {c.specialty}</small></span></div></td><td>{c.owner}</td><td>{c.collar_bound?<select disabled={!canCommand} className="rank-select" aria-label={'Change bound rank for '+c.name} value={c.rank} onChange={e=>changeRank(c,e.target.value)}>{BOUND_RANKS.map(k=><option key={k} value={k}>{k}</option>)}</select>:<span className="roster-free-tag">Free / Unbound</span>}</td><td className="gil-cell">{c.view_mode==='bound'?'Sealed':gil(c.gil)}</td><td><div className="cell-actions"><button className="mini-btn" onClick={()=>{setSelectedId(c.id);setTab('sheet')}}>Open</button>{canEdit(c)&&<button className="mini-btn" onClick={()=>{setSelectedId(c.id);setTab('sheet');setEditor({...c})}}>Edit</button>}{canCommand&&<button className="mini-btn danger" onClick={()=>removeCharacter(c)}>Delete</button>}</div></td></tr>)}</tbody></table></div>
        {filtered.length===0&&<Empty title={rosterGroup==='bound'?'No bound characters here':'No free members here'} detail="Try a different search or create a character."/>}</section>}
        {tab==='sheet' && <><div className="sheet-picker"><label htmlFor="sheet-select">SELECT CHARACTER</label><select id="sheet-select" value={selected?.id||''} onChange={e=>{setSelectedId(e.target.value);setRoll(null);}}><option value="" disabled>Choose a character</option>{characters.map(c=><option value={c.id} key={c.id}>{c.name} — {c.player}</option>)}</select>{selected&&canEdit(selected)&&<button className="btn secondary" onClick={()=>setEditor({...selected})}>Edit sheet</button>}</div>{editor?.id&&selected?.id===editor.id&&canEdit(selected)?<InlineSheetEditor key={editor.id} character={editor} canCommand={canCommand} members={members} saving={sheetSaving}
 onSave={candidate=>saveCharacter({preventDefault(){}},candidate)}
 onCancel={()=>setEditor(null)}/>:!selected?<div className="panel"><Empty title="No character selected" detail="Create a record to begin using character sheets."/></div>:(selected.view_mode==='bound'?<LimitedSheet character={selected}/>:<><div className="sheet-grid"><section className="panel sheet-profile"><div className="profile-head"><div className="avatar large">{glyph(selected.name)}</div><div><div className="eyebrow">CHARACTER RECORD</div><h2>{selected.name}</h2><p>{selected.player}</p><RankTag rank={selected.rank}/></div></div><div className="detail-grid"><div><small>SPECIALTY</small><strong>{selected.specialty}</strong></div><div><small>ASSIGNED TO</small><strong>{selected.owner}</strong></div><div><small>HIT POINTS</small><strong>{selected.hp} HP</strong></div><div><small>GIL BALANCE</small><strong>{gil(selected.gil)} Gil</strong></div><div><small>ALLOTMENT</small><strong>{RANKS[selected.rank].food}</strong></div><div><small>GIL CUT</small><strong>{RANKS[selected.rank].cut}%</strong></div></div><h3>Attributes</h3><div className="attributes">{STATS.map(key=><div className="attribute" key={key}><small>{key.toUpperCase()}</small><strong>{selected[key]}</strong><span>{Math.floor((selected[key]-10)/2)>=0?'+':''}{Math.floor((selected[key]-10)/2)} modifier</span></div>)}</div><h3>Notes</h3><p className="notes">{selected.notes||'No notes on record.'}</p></section><section className="panel roller-panel"><div className="panel-heading"><div><h2>Dice chamber</h2><p>Roll using this character's modifiers</p></div><span className="dice-icon">⚄</span></div><div className="dice-controls"><Field label="ATTRIBUTE"><select value={rollStat} onChange={e=>setRollStat(e.target.value)}>{STATS.map(k=><option key={k} value={k}>{k.toUpperCase()} · {selected[k]}</option>)}</select></Field><Field label="DICE"><select value={diceSides} onChange={e=>setDiceSides(Number(e.target.value))}>{[4,6,8,10,12,20,100].map(n=><option key={n} value={n}>d{n}</option>)}</select></Field></div><button className="btn primary roll-btn" onClick={doRoll}>⚄ Roll dice</button>{roll?<div className="roll-outcome" role="status"><small>ROLL RESULT · {roll.stat} · D{roll.sides}</small><div>{roll.total}</div><p>Natural roll {roll.raw} {roll.statMod<0?'-':'+'} {Math.abs(roll.statMod)} stat {roll.rankMod<0?'-':'+'} {Math.abs(roll.rankMod)} rank</p></div>:<div className="roll-placeholder">Select an attribute and roll to reveal your result.</div>}<div className="hint-box"><strong>Calculation</strong><p>Dice result + ⌊(attribute − 10) / 2⌋ + rank modifier. Rolls happen locally using the browser's random number generator.</p></div></section></div><FullDndSheet character={selected}/></>)}</>}
        {tab==='market' && <div className="market-layout"><section className="panel"><div className="panel-heading wrap"><div><h2>Contraband catalogue</h2><p>Reference prices and rank requirements</p></div><select aria-label="Filter market by rank" value={marketFilter} onChange={e=>setMarketFilter(e.target.value)}><option value="all">All requirements</option>{['Rank I','Rank II','Rank III','Rank IV'].map(x=><option key={x}>{x}</option>)}</select></div><div className="market-list">{SHOP_ITEMS.filter(item=>marketFilter==='all'||item.rank===marketFilter).map(item=><div className="market-item" key={item.name}><span className="item-glyph">◆</span><div><strong>{item.name}</strong><p>{item.effect}</p><span className="item-rank">{item.rank} required</span></div><b>{gil(item.cost)} <small>GIL</small></b></div>)}</div></section><section className="panel"><div className="panel-heading"><div><h2>Ration & privileges</h2><p>Benefits by rank</p></div></div>{RANK_KEYS.map((key,i)=><div className="ration" key={key}><RankTag rank={key}/><strong>{RANKS[key].food}</strong><p>{RANKS[key].cut}% gil cut · {RANKS[key].mod>=0?'+':''}{RANKS[key].mod} dice modifier</p></div>)}<div className="hint-box"><strong>Catalogue only</strong><p>Prices are reference information. This static workspace does not process purchases or transfer gil.</p></div></section></div>}
        {tab==='scenes'&&configured&&session&&<Encounters role={accountRole} userId={session.user?.id} characters={characters} onOpenProfile={()=>setTab('profile')}/>}
        {tab==='profile'&&configured&&session&&<ProfileConsent/>}
        {tab==='directory'&&configured&&session&&<MemberRPDirectory/>}
        {tab==='transitions'&&configured&&session&&<CharacterTransitions characters={characters} role={accountRole} userId={session.user?.id} onRefresh={refreshCharacters}/>}
        {tab==='members'&&['domina','high_command'].includes(accountRole)&&<MemberDirectory members={members} currentRole={accountRole} onChangeRole={changeMemberRole} onChangeStanding={changeMemberStanding}/>}
        {tab==='settings' && <div className="settings-grid"><section className="panel"><h2>Backup & restore</h2><p className="muted">Export your complete ledger as JSON before changing browsers or clearing site data.</p><div className="settings-actions">{canCommand&&<button className="btn primary" onClick={()=>downloadFile('eclipse-order-ledger.json',JSON.stringify({version:3,characters},null,2))}>Download JSON backup</button>}{canCommand&&<button className="btn secondary" onClick={()=>importRef.current?.click()}>Import JSON backup</button>}{configured&&canCommand&&<button className="btn secondary" onClick={migrateLocal}>Migrate saved browser records</button>}<input hidden ref={importRef} type="file" accept=".json,application/json" onChange={importBackup}/></div><p className="fine-print">{configured?'Import adds or updates shared records. Existing unrelated records are retained.':'Import replaces the current ledger after confirmation. Existing browser records are migrated from earlier app versions on first use.'}</p></section><section className="panel"><h2>Workspace information</h2><div className="settings-line"><span>Storage</span><strong>{configured?'Supabase PostgreSQL':'Browser localStorage'}</strong></div><div className="settings-line"><span>Character records</span><strong>{characters.length}</strong></div><div className="settings-line"><span>Accounts & permissions</span><strong>{configured?'Supabase Auth':'Not configured'}</strong></div><div className="settings-line"><span>Shared database</span><strong>{configured?'Connected':'Not connected'}</strong></div><div className="alert">{configured?'Approved members access this shared ledger through Supabase authentication and database row-level security. Role-based permissions protect the roster and collar-bound sheets at the database layer.':'This static site is not an authenticated application. Do not store passwords, private personal information or sensitive records here.'}</div></section></div>}
        {tab==='settings'&&configured&&accountRole&&<FCSettings role={accountRole}/>}
      </div>
    </main>
    {editor && !editor.id && <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setEditor(null);}}><form className="modal" onSubmit={saveCharacter}><div className="modal-head"><div><div className="eyebrow">LEDGER ENTRY</div><h2>{editor.id?'Edit character':'New character'}</h2></div><button type="button" className="icon-button" aria-label="Close editor" onClick={()=>setEditor(null)}>✕</button></div><div className="modal-body"><div className="form-grid"><Field label="CHARACTER NAME *"><input required maxLength={80} value={editor.name} onChange={e=>setEditor({...editor,name:e.target.value})}/></Field><Field label="PLAYER HANDLE"><input disabled={!canCommand} maxLength={80} value={editor.player} onChange={e=>setEditor({...editor,player:e.target.value})}/></Field><Field label="ASSIGNED TO"><input disabled={!canCommand} maxLength={80} value={editor.owner} onChange={e=>setEditor({...editor,owner:e.target.value})}/></Field><Field label="SPECIALTY"><input maxLength={100} value={editor.specialty} onChange={e=>setEditor({...editor,specialty:e.target.value})}/></Field><Field label="RANK"><select disabled={!canCommand} value={editor.rank} onChange={e=>setEditor({...editor,rank:e.target.value})}>{RANK_KEYS.map(k=><option key={k}>{k}</option>)}</select></Field><Field label="GIL BALANCE"><input disabled={!canCommand} type="number" min="0" max="999999999" value={editor.gil} onChange={e=>setEditor({...editor,gil:e.target.value})}/></Field><Field label="HIT POINTS"><input type="number" min="0" max="999999999" value={editor.hp} onChange={e=>setEditor({...editor,hp:e.target.value})}/></Field></div>
  {canCommand&&<div className="form-grid">
    <Field label="COLLAR STATUS"><select disabled={Boolean(editor.id)||Boolean(editor.player_user_id)} value={editor.collar_bound?'bound':'free'} onChange={e=>setEditor({...editor,collar_bound:e.target.value==='bound',rank:e.target.value==='bound'?'Rank I: Fresh Intake / Unbroken':'Unbound: Free'})}><option value="free">Free — full sheet</option><option value="bound">Bound (unlinked NPC only)</option></select></Field>
    <Field label="ASSIGNED PLAYER ACCOUNT"><select value={editor.player_user_id||''} onChange={e=>setEditor({...editor,player_user_id:e.target.value})}><option value="">No linked account</option>{members.map(m=><option key={m.user_id} value={m.user_id}>{m.email}</option>)}</select></Field>
    <Field label="MASTER / MISTRESS ACCOUNT"><select value={editor.handler_user_id||''} onChange={e=>setEditor({...editor,handler_user_id:e.target.value})}><option value="">No assigned handler</option>{members.filter(m=>['domina','high_command','handler'].includes(m.role)).map(m=><option key={m.user_id} value={m.user_id}>{m.email} · {ACCOUNT_ROLES[m.role]?.label}</option>)}</select></Field>
  </div>}
  <h3>Full D&D character sheet</h3>
  <div className="form-grid">
    {[
      ['class_name','CLASS / JOB'],['species','SPECIES / RACE'],['background','BACKGROUND'],
      ['alignment','ALIGNMENT'],['hit_dice','HIT DICE']
    ].map(([key,label])=><Field key={key} label={label}><input value={editor[key]||''} onChange={e=>setEditor({...editor,[key]:e.target.value})}/></Field>)}
    {[
      ['level','LEVEL',1,20],['experience','EXPERIENCE',0,999999999],
      ['armor_class','ARMOR CLASS',0,40],['speed','SPEED (FT)',0,200],
      ['proficiency_bonus','PROFICIENCY BONUS',0,10],['max_hp','MAX HP',0,999999999],['temp_hp','TEMP HP',0,999999999]
    ].map(([key,label,min,max])=><Field key={key} label={label}><input type="number" min={min} max={max} value={editor[key]??(key==='level'?1:0)} onChange={e=>setEditor({...editor,[key]:Number(e.target.value)})}/></Field>)}
  </div>
  <h3>Character attributes</h3><div className="stat-inputs">{STATS.map(k=><Field key={k} label={k.toUpperCase()}><input type="number" min="1" max="30" value={editor[k]} onChange={e=>setEditor({...editor,[k]:e.target.value})}/></Field>)}</div>
  <h3>Saving throw proficiencies</h3>
  <div className="check-grid">{STATS.map(k=><label key={k} className="check-option"><input type="checkbox" checked={Boolean(editor.saving_throws?.[k])} onChange={e=>setEditor({...editor,saving_throws:{...editor.saving_throws,[k]:e.target.checked}})}/>{k.toUpperCase()}</label>)}</div>
  <h3>Skill proficiencies</h3>
  <div className="check-grid">{['Acrobatics','Animal Handling','Arcana','Athletics','Deception','History','Insight','Intimidation','Investigation','Medicine','Nature','Perception','Performance','Persuasion','Religion','Sleight of Hand','Stealth','Survival'].map(k=><label key={k} className="check-option"><input type="checkbox" checked={Boolean(editor.skills?.[k])} onChange={e=>setEditor({...editor,skills:{...editor.skills,[k]:e.target.checked}})}/>{k}</label>)}</div>
  <h3>Features, gear & roleplay</h3>
  <div className="form-grid">
    {[
      ['features','FEATURES & TRAITS'],['proficiencies','PROFICIENCIES & LANGUAGES'],
      ['spells','SPELLS & MAGIC'],['inventory','INVENTORY & EQUIPMENT'],
      ['conditions','CONDITIONS'],['personality','PERSONALITY TRAITS'],
      ['ideals','IDEALS'],['bonds','BONDS'],['flaws','FLAWS']
    ].map(([key,label])=><Field key={key} label={label}><textarea rows="3" value={editor[key]||''} onChange={e=>setEditor({...editor,[key]:e.target.value})}/></Field>)}
  </div>
  <Field label="LEDGER NOTES"><textarea rows="3" maxLength={4000} value={editor.notes} onChange={e=>setEditor({...editor,notes:e.target.value})}/></Field></div><div className="modal-footer"><button type="button" className="btn secondary" onClick={()=>setEditor(null)}>Cancel</button><button type="submit" className="btn primary">Save character</button></div></form></div>}
  </div>;
}
