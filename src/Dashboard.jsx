import React, { useEffect, useMemo, useRef, useState } from 'react';
import { INITIAL_SLAVES, RANKS, SHOP_ITEMS } from './data/initialData.js';
import './dashboard.css';

const KEY = 'eclipse-order-ledger-v3';
const NAV = [['overview','Overview','◈'],['roster','Character roster','▦'],['sheet','Character sheets','◇'],['market','Black Market','◆'],['settings','Workspace & backup','⚙']];
const STATS = ['str','dex','con','int','wis','cha'];
const RANK_KEYS = Object.keys(RANKS);
const glyph = (value) => String(value || '').slice(0, 1).toUpperCase() || '?';
const gil = (n) => Math.max(0, Number(n) || 0).toLocaleString('en-US');
const safeNumber = (n, fallback = 0, min = 0, max = 999999999) => Number.isFinite(Number(n)) ? Math.min(max, Math.max(min, Number(n))) : fallback;
const normalize = (r, index) => ({
  id: String(r.id ?? 'import-' + index), name: String(r.name || 'Unnamed character').slice(0, 80),
  player: String(r.player || '@Unknown').slice(0, 80), owner: String(r.owner || 'Unassigned').slice(0, 80),
  specialty: String(r.specialty || 'Unassigned').slice(0, 100),
  rank: RANKS[r.rank] ? r.rank : RANK_KEYS[0], notes: String(r.notes || '').slice(0, 4000),
  hp: safeNumber(r.hp, 20), gil: safeNumber(r.gil),
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
const fresh = () => ({name:'',player:'',owner:'',specialty:'',rank:RANK_KEYS[0],hp:20,gil:0,notes:'',str:10,dex:10,con:10,int:10,wis:10,cha:10});
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
  const [characters,setCharacters] = useState(readLedger);
  const [tab,setTab] = useState('overview');
  const [search,setSearch] = useState('');
  const [rankFilter,setRankFilter] = useState('all');
  const [selectedId,setSelectedId] = useState(null);
  const [editor,setEditor] = useState(null);
  const [roll,setRoll] = useState(null);
  const [rollStat,setRollStat] = useState('str');
  const [diceSides,setDiceSides] = useState(20);
  const [marketFilter,setMarketFilter] = useState('all');
  const [notice,setNotice] = useState('');
  const [saveError,setSaveError] = useState('');
  const importRef = useRef(null);
  useEffect(() => { try { localStorage.setItem(KEY,JSON.stringify({version:3,characters}));setSaveError(''); } catch {setSaveError('Browser storage is unavailable or full. Export a backup to avoid data loss.');} },[characters]);
  useEffect(() => {if (!selectedId || !characters.some(c=>c.id===selectedId)) setSelectedId(characters[0]?.id ?? null);},[characters,selectedId]);
  const selected = characters.find(c=>c.id===selectedId) || null;
  const filtered = useMemo(() => characters.filter(c => (rankFilter==='all' || c.rank===rankFilter) && [c.name,c.player,c.owner,c.specialty].join(' ').toLowerCase().includes(search.toLowerCase())).sort((a,b)=>a.name.localeCompare(b.name)),[characters,rankFilter,search]);
  const totalGil = characters.reduce((a,c)=>a+c.gil,0);
  const topRank = characters.filter(c=>rankIndex(c.rank)>=2).length;
  const warn = message => {setNotice(message);window.setTimeout(()=>setNotice(''),4200);};
  function saveCharacter(e) {
    e.preventDefault();
    if (!editor?.name.trim()) return;
    const isNew=!editor.id;
    const id=editor.id || (globalThis.crypto?.randomUUID?.() || String(Date.now()));
    const record=normalize({...editor,id,name:editor.name.trim()},0);
    setCharacters(old => isNew ? [record,...old] : old.map(c=>c.id===id?record:c));
    setSelectedId(id);setEditor(null);setTab('sheet');warn(isNew?'Character added to this browser.':'Character changes saved.');
  }
  function removeCharacter(c) {
    if (!window.confirm('Remove '+c.name+' from this browser ledger? Export a backup first if needed.')) return;
    setCharacters(old=>old.filter(x=>x.id!==c.id));setEditor(null);warn('Character removed.');
  }
  function changeRank(c,newRank) {setCharacters(old=>old.map(x=>x.id===c.id?{...x,rank:newRank}:x));warn('Rank updated locally.');}
  function doRoll() {
    if (!selected) return;
    const raw=Math.floor(Math.random()*diceSides)+1;
    const statMod=Math.floor((selected[rollStat]-10)/2);
    const rankMod=RANKS[selected.rank]?.mod || 0;
    setRoll({raw,statMod,rankMod,total:raw+statMod+rankMod,sides:diceSides,stat:rollStat.toUpperCase()});
  }
  async function importBackup(e) {
    const file=e.target.files?.[0]; if (!file) return;
    try {
      if (file.size > 2000000) throw Error('Backup file is too large (maximum 2 MB).');
      const parsed=JSON.parse(await file.text());
      const records=Array.isArray(parsed)?parsed:parsed.characters;
      if (!Array.isArray(records) || records.length>5000) throw Error('Expected a JSON ledger with up to 5,000 characters.');
      const cleaned=records.filter(c=>c && typeof c==='object' && !Array.isArray(c)).map(normalize);
      const ids=new Set();
      cleaned.forEach((c,i)=>{if(ids.has(c.id))c.id=c.id+'-'+i;ids.add(c.id);});
      if (!window.confirm('Replace the current local ledger with '+cleaned.length+' imported characters? Export your existing ledger first.')) return;
      setCharacters(cleaned);setRoll(null);warn('Backup imported successfully.');
    } catch(err) {warn('Import failed: '+err.message);}
    finally {e.target.value='';}
  }
  const actions=<><button className="btn secondary" onClick={()=>{setEditor(fresh());}}>+ New character</button><button className="btn primary" onClick={()=>{downloadFile('eclipse-order-ledger-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify({version:3,exportedAt:new Date().toISOString(),characters},null,2));warn('Backup downloaded.');}}>↓ Export backup</button></>;
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-sigil">✦</span><div><strong>ECLIPSE ORDER</strong><small>THE UNDERWORLD LEDGER</small></div></div>
      <div className="workspace-chip"><span className="pulse"/> Local workspace <small>Private to this browser</small></div>
      <p className="nav-label">COMMAND CENTER</p>
      <nav aria-label="Primary navigation">{NAV.map(([id,label,symbol])=><button key={id} className={'nav-link '+(tab===id?'active':'')} onClick={()=>{setTab(id);setEditor(null);}}><span className="nav-symbol">{symbol}</span>{label}</button>)}</nav>
      <div className="side-bottom"><div className="monogram">EO</div><div><strong>Local session</strong><small>No account authentication</small></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="breadcrumb">ECLIPSE ORDER <span>/</span> {NAV.find(x=>x[0]===tab)?.[1]}</div><div className="top-actions"><span className="local-status"><span className="pulse"/> Browser-saved</span><button className="icon-button" title="Open workspace settings" aria-label="Open workspace settings" onClick={()=>setTab('settings')}>⚙</button></div></header>
      <div className="content">
        <div className="page-intro"><div><div className="eyebrow">ORDER OPERATIONS <span className="eyebrow-line"/></div><h1>{tab==='overview'?'Command overview':NAV.find(x=>x[0]===tab)?.[1]}</h1><p>{({overview:'The ledger at a glance. Manage your roster, ranks and records.',roster:'Search and administer every character in the ledger.',sheet:'Character details, attributes and tabletop dice checks.',market:'Browse the Black Market catalogue and rank allowances.',settings:'Manage browser storage, backups and workspace safety.'})[tab]}</p></div><div className="intro-actions">{actions}</div></div>
        {saveError && <div className="alert" role="alert">{saveError}</div>}
        {notice && <div className="toast" role="status">{notice}</div>}
        {tab==='overview' && <><div className="stat-grid">
          <div className="stat-card"><small>REGISTERED CHARACTERS</small><b>{characters.length}</b><span>In this ledger</span><div className="card-mark">◇</div></div>
          <div className="stat-card"><small>ADVANCED RANKS</small><b>{topRank}</b><span>Rank III and IV</span><div className="card-mark">✦</div></div>
          <div className="stat-card"><small>TOTAL RECORDED GIL</small><b>{gil(totalGil)}</b><span>Combined character balances</span><div className="card-mark">◆</div></div>
          <div className="stat-card"><small>RANK TIERS</small><b>{RANK_KEYS.length}</b><span>Configured privileges</span><div className="card-mark">▤</div></div>
        </div><div className="overview-grid"><section className="panel"><div className="panel-heading"><div><h2>Recent roster</h2><p>Quick access to character records</p></div><button className="text-button" onClick={()=>setTab('roster')}>View all →</button></div>{characters.length?characters.slice(0,5).map(c=><button key={c.id} className="character-row" onClick={()=>{setSelectedId(c.id);setTab('sheet');}}><span className="avatar">{glyph(c.name)}</span><span className="character-name"><strong>{c.name}</strong><small>{c.player} · {c.specialty}</small></span><RankTag rank={c.rank}/><span className="row-arrow">›</span></button>):<Empty title="Your roster is empty" detail="Create a character to get started."/>}</section><section className="panel"><div className="panel-heading"><div><h2>Rank distribution</h2><p>Breakdown of the active ledger</p></div></div><div className="distribution">{RANK_KEYS.map((key,i)=>{const count=characters.filter(c=>c.rank===key).length;return <div className="dist-item" key={key}><div className="dist-head"><span className={'rank-dot rank-bg-'+i}/><span>{key}</span><strong>{count}</strong></div><div className="track"><span className={'fill rank-bg-'+i} style={{width:(characters.length?count/characters.length*100:0)+'%'}}/></div></div>})}</div><div className="hint-box"><strong>Workspace notice</strong><p>This is a local roleplay record manager, not a secure shared service. Data and changes stay in this browser until you export them.</p></div></section></div></>}
        {tab==='roster' && <section className="panel"><div className="panel-heading wrap"><div><h2>Character directory <span className="sub-count">{filtered.length}</span></h2><p>Use search and rank filters to narrow the list.</p></div><div className="filters"><input aria-label="Search characters" placeholder="Search characters, players..." value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Filter by rank" value={rankFilter} onChange={e=>setRankFilter(e.target.value)}><option value="all">All ranks</option>{RANK_KEYS.map(k=><option key={k}>{k}</option>)}</select></div></div><div className="table-scroll"><table><thead><tr><th>CHARACTER</th><th>ASSIGNED TO</th><th>RANK</th><th>GIL</th><th>MANAGE</th></tr></thead><tbody>{filtered.map(c=><tr key={c.id}><td><div className="table-identity"><span className="avatar">{glyph(c.name)}</span><span><strong>{c.name}</strong><small>{c.player} · {c.specialty}</small></span></div></td><td>{c.owner}</td><td><select className="rank-select" aria-label={'Change rank for '+c.name} value={c.rank} onChange={e=>changeRank(c,e.target.value)}>{RANK_KEYS.map(k=><option key={k}>{k}</option>)}</select></td><td className="gil-cell">{gil(c.gil)}</td><td><div className="cell-actions"><button className="mini-btn" onClick={()=>{setSelectedId(c.id);setTab('sheet');}}>Open</button><button className="mini-btn" onClick={()=>setEditor({...c})}>Edit</button><button className="mini-btn danger" onClick={()=>removeCharacter(c)}>Delete</button></div></td></tr>)}</tbody></table></div>{filtered.length===0&&<Empty title="No matching records" detail="Try another search or create a new character."/>}</section>}
        {tab==='sheet' && <><div className="sheet-picker"><label htmlFor="sheet-select">SELECT CHARACTER</label><select id="sheet-select" value={selected?.id||''} onChange={e=>{setSelectedId(e.target.value);setRoll(null);}}><option value="" disabled>Choose a character</option>{characters.map(c=><option value={c.id} key={c.id}>{c.name} — {c.player}</option>)}</select>{selected&&<button className="btn secondary" onClick={()=>setEditor({...selected})}>Edit sheet</button>}</div>{!selected?<div className="panel"><Empty title="No character selected" detail="Create a record to begin using character sheets."/></div>:<div className="sheet-grid"><section className="panel sheet-profile"><div className="profile-head"><div className="avatar large">{glyph(selected.name)}</div><div><div className="eyebrow">CHARACTER RECORD</div><h2>{selected.name}</h2><p>{selected.player}</p><RankTag rank={selected.rank}/></div></div><div className="detail-grid"><div><small>SPECIALTY</small><strong>{selected.specialty}</strong></div><div><small>ASSIGNED TO</small><strong>{selected.owner}</strong></div><div><small>HIT POINTS</small><strong>{selected.hp} HP</strong></div><div><small>GIL BALANCE</small><strong>{gil(selected.gil)} Gil</strong></div><div><small>ALLOTMENT</small><strong>{RANKS[selected.rank].food}</strong></div><div><small>GIL CUT</small><strong>{RANKS[selected.rank].cut}%</strong></div></div><h3>Attributes</h3><div className="attributes">{STATS.map(key=><div className="attribute" key={key}><small>{key.toUpperCase()}</small><strong>{selected[key]}</strong><span>{Math.floor((selected[key]-10)/2)>=0?'+':''}{Math.floor((selected[key]-10)/2)} modifier</span></div>)}</div><h3>Notes</h3><p className="notes">{selected.notes||'No notes on record.'}</p></section><section className="panel roller-panel"><div className="panel-heading"><div><h2>Dice chamber</h2><p>Roll using this character's modifiers</p></div><span className="dice-icon">⚄</span></div><div className="dice-controls"><Field label="ATTRIBUTE"><select value={rollStat} onChange={e=>setRollStat(e.target.value)}>{STATS.map(k=><option key={k} value={k}>{k.toUpperCase()} · {selected[k]}</option>)}</select></Field><Field label="DICE"><select value={diceSides} onChange={e=>setDiceSides(Number(e.target.value))}>{[4,6,8,10,12,20,100].map(n=><option key={n} value={n}>d{n}</option>)}</select></Field></div><button className="btn primary roll-btn" onClick={doRoll}>⚄ Roll dice</button>{roll?<div className="roll-outcome" role="status"><small>ROLL RESULT · {roll.stat} · D{roll.sides}</small><div>{roll.total}</div><p>Natural roll {roll.raw} {roll.statMod<0?'-':'+'} {Math.abs(roll.statMod)} stat {roll.rankMod<0?'-':'+'} {Math.abs(roll.rankMod)} rank</p></div>:<div className="roll-placeholder">Select an attribute and roll to reveal your result.</div>}<div className="hint-box"><strong>Calculation</strong><p>Dice result + ⌊(attribute − 10) / 2⌋ + rank modifier. Rolls happen locally using the browser's random number generator.</p></div></section></div>}</>}
        {tab==='market' && <div className="market-layout"><section className="panel"><div className="panel-heading wrap"><div><h2>Contraband catalogue</h2><p>Reference prices and rank requirements</p></div><select aria-label="Filter market by rank" value={marketFilter} onChange={e=>setMarketFilter(e.target.value)}><option value="all">All requirements</option>{['Rank I','Rank II','Rank III','Rank IV'].map(x=><option key={x}>{x}</option>)}</select></div><div className="market-list">{SHOP_ITEMS.filter(item=>marketFilter==='all'||item.rank===marketFilter).map(item=><div className="market-item" key={item.name}><span className="item-glyph">◆</span><div><strong>{item.name}</strong><p>{item.effect}</p><span className="item-rank">{item.rank} required</span></div><b>{gil(item.cost)} <small>GIL</small></b></div>)}</div></section><section className="panel"><div className="panel-heading"><div><h2>Ration & privileges</h2><p>Benefits by rank</p></div></div>{RANK_KEYS.map((key,i)=><div className="ration" key={key}><RankTag rank={key}/><strong>{RANKS[key].food}</strong><p>{RANKS[key].cut}% gil cut · {RANKS[key].mod>=0?'+':''}{RANKS[key].mod} dice modifier</p></div>)}<div className="hint-box"><strong>Catalogue only</strong><p>Prices are reference information. This static workspace does not process purchases or transfer gil.</p></div></section></div>}
        {tab==='settings' && <div className="settings-grid"><section className="panel"><h2>Backup & restore</h2><p className="muted">Export your complete ledger as JSON before changing browsers or clearing site data.</p><div className="settings-actions"><button className="btn primary" onClick={()=>downloadFile('eclipse-order-ledger.json',JSON.stringify({version:3,characters},null,2))}>Download JSON backup</button><button className="btn secondary" onClick={()=>importRef.current?.click()}>Import JSON backup</button><input hidden ref={importRef} type="file" accept=".json,application/json" onChange={importBackup}/></div><p className="fine-print">Import replaces the current ledger after confirmation. Existing browser records are migrated from earlier app versions on first use.</p></section><section className="panel"><h2>Workspace information</h2><div className="settings-line"><span>Storage</span><strong>Browser localStorage</strong></div><div className="settings-line"><span>Character records</span><strong>{characters.length}</strong></div><div className="settings-line"><span>Accounts & permissions</span><strong>Not configured</strong></div><div className="settings-line"><span>Shared database</span><strong>Not connected</strong></div><div className="alert">This static site is not an authenticated application. Do not store passwords, private personal information or sensitive records here.</div></section></div>}
      </div>
    </main>
    {editor && <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setEditor(null);}}><form className="modal" onSubmit={saveCharacter}><div className="modal-head"><div><div className="eyebrow">LEDGER ENTRY</div><h2>{editor.id?'Edit character':'New character'}</h2></div><button type="button" className="icon-button" aria-label="Close editor" onClick={()=>setEditor(null)}>✕</button></div><div className="modal-body"><div className="form-grid"><Field label="CHARACTER NAME *"><input required maxLength={80} value={editor.name} onChange={e=>setEditor({...editor,name:e.target.value})}/></Field><Field label="PLAYER HANDLE"><input maxLength={80} value={editor.player} onChange={e=>setEditor({...editor,player:e.target.value})}/></Field><Field label="ASSIGNED TO"><input maxLength={80} value={editor.owner} onChange={e=>setEditor({...editor,owner:e.target.value})}/></Field><Field label="SPECIALTY"><input maxLength={100} value={editor.specialty} onChange={e=>setEditor({...editor,specialty:e.target.value})}/></Field><Field label="RANK"><select value={editor.rank} onChange={e=>setEditor({...editor,rank:e.target.value})}>{RANK_KEYS.map(k=><option key={k}>{k}</option>)}</select></Field><Field label="GIL BALANCE"><input type="number" min="0" max="999999999" value={editor.gil} onChange={e=>setEditor({...editor,gil:e.target.value})}/></Field><Field label="HIT POINTS"><input type="number" min="0" max="999999999" value={editor.hp} onChange={e=>setEditor({...editor,hp:e.target.value})}/></Field></div><h3>Character attributes</h3><div className="stat-inputs">{STATS.map(k=><Field key={k} label={k.toUpperCase()}><input type="number" min="1" max="30" value={editor[k]} onChange={e=>setEditor({...editor,[k]:e.target.value})}/></Field>)}</div><Field label="LEDGER NOTES"><textarea rows="3" maxLength={4000} value={editor.notes} onChange={e=>setEditor({...editor,notes:e.target.value})}/></Field></div><div className="modal-footer"><button type="button" className="btn secondary" onClick={()=>setEditor(null)}>Cancel</button><button type="submit" className="btn primary">Save character</button></div></form></div>}
  </div>;
}
