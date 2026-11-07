import React,{useEffect,useMemo,useState} from 'react';
import './order-navigation.css';
import OrderEmblem from './OrderEmblem.jsx';

const SECTION_MAP={
 overview:'home',
 roster:'characters',sheet:'characters',
 scenes:'activities',encounters:'activities',events:'activities',construction:'activities',factions:'activities',workshop:'activities',trade:'activities',fronts:'activities',treasury:'activities',
 profile:'community',directory:'community',transitions:'community',
 members:'administration',governance:'administration',lore:'administration',
 settings:'administration'
};
const GROUPS=[
 {id:'home',name:'YOUR SPACE',hint:'Start here'},
 {id:'characters',name:'CHARACTERS',hint:'Rosters and dossiers'},
 {id:'activities',name:'OPERATIONS',hint:'Events and encounters'},
 {id:'community',name:'COMMUNITY',hint:'Profiles and connections'},
 {id:'administration',name:'ORDER MANAGEMENT',hint:'Staff and records'}
];
const DESCRIPTIONS={
 overview:'Your starting point',roster:'Browse the Order',sheet:'Details and progression',
 scenes:'Battle maps and dice',encounters:'Combat and battle maps',events:'Schedule and attend',construction:'Collaborative long-form construction and restoration',factions:'Allies, rivals and diplomacy',workshop:'Shared stores, crafting and garden',trade:'Faction and settlement delivery contracts',fronts:'Approved member businesses and Order trade fronts',treasury:'Trade income, daily wages and completed mission pay',
 profile:'Preferences and boundaries',directory:'Member introductions',
 transitions:'Character requests',members:'Roles and applications',
 governance:'The Order’s governing chamber and charter',
 settings:'Rules and records',lore:'The Order’s history, figures and places'
};

export const getNavSection=(id)=>GROUPS.find(g=>g.id===SECTION_MAP[id])?.name||'WORKSPACE';

export default function OrderNavigation({
 items=[],active,onNavigate,open,onClose,footer,mode='staff'
}){
 const [filter,setFilter]=useState('');
 const [closed,setClosed]=useState({});
 const query=filter.trim().toLowerCase();
 const groups=useMemo(()=>GROUPS.map(group=>({
  ...group,
  items:items.filter(([id,label])=>SECTION_MAP[id]===group.id&&
   (!query||[label,DESCRIPTIONS[id],group.name].join(' ').toLowerCase().includes(query)))
 })).filter(group=>group.items.length),[items,query]);
 useEffect(()=>{
  if(!open)return;
  const key=e=>{if(e.key==='Escape')onClose?.()};
  window.addEventListener('keydown',key);
  return()=>window.removeEventListener('keydown',key);
 },[open,onClose]);
 const visit=id=>{onNavigate(id);onClose?.()};
 return <>
  {open&&<button type="button" className="order-nav-backdrop" aria-label="Close navigation" onClick={onClose}/>}
  <aside className={'sidebar order-nav '+(open?'order-nav-open':'')} aria-label="Workspace sidebar">
   <div className="order-nav-brand">
    <span className="order-nav-brand-icon" aria-hidden="true"><OrderEmblem className="order-nav-emblem"/></span>
    <div><strong>THE ECLIPSE ORDER</strong><small>SYNDICATE PORTAL</small></div>
    <button type="button" className="order-nav-close" aria-label="Close menu" onClick={onClose}>×</button>
   </div>
   <div className="order-nav-workspace"><span className="order-nav-pulse"/> <span>{mode==='member'?'Member portal':'Order command'}<small>{mode==='member'?'Your personal workspace':'Operations and administration'}</small></span></div>
   <label className="order-nav-search"><span className="order-nav-search-mark" aria-hidden="true">⌕</span><input type="search" aria-label="Find a page" placeholder="Find a page…" value={filter} onChange={e=>setFilter(e.target.value)}/>{filter&&<button type="button" onClick={()=>setFilter('')} aria-label="Clear navigation search">×</button>}</label>
   <nav className="order-nav-groups" aria-label="Primary navigation">
    {groups.length===0&&<p className="order-nav-empty">No matching pages.</p>}
    {groups.map(group=><section className="order-nav-group" key={group.id} aria-label={group.name}>
     <button type="button" className="order-nav-group-head" aria-expanded={query?true:!closed[group.id]} onClick={()=>setClosed(c=>({...c,[group.id]:!c[group.id]}))}>
      <span>{group.name}</span><span aria-hidden="true">{query?'−':closed[group.id]?'+':'−'}</span>
     </button>
     {(query||!closed[group.id])&&<div className="order-nav-items">{group.items.map(([id,label,symbol])=><button type="button" key={id} className={'order-nav-item '+(active===id?'active':'')} aria-current={active===id?'page':undefined} title={label} onClick={()=>visit(id)}>
      <span className="order-nav-symbol" aria-hidden="true">{symbol}</span>
      <span className="order-nav-text"><strong>{label}</strong><small>{DESCRIPTIONS[id]||''}</small></span>
      {active===id&&<span className="order-nav-current" aria-hidden="true"/>}
     </button>)}</div>}
    </section>)}
   </nav>
   <div className="order-nav-footer">{footer}</div>
  </aside>
 </>;
}
