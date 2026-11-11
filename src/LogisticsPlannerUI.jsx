import React,{useState} from 'react';
export const modes={road:{icon:'fa-truck-fast',title:'Road convoy',summary:'Flexible routes and farm collection',trait:'STANDARD FUEL'},rail:{icon:'fa-train',title:'Rail freight',summary:'Heavy cargo over railway services',trait:'BULK CAPACITY'},air:{icon:'fa-plane',title:'Garlean airship',summary:'Fast, costly, needs landing docks',trait:'HIGH FUEL COST'}};
export function ModeCards({value,onChange,options=['road','rail','air']}){return <div className="lp-modes" role="group" aria-label="Transport modes">{options.map(mode=><button key={mode} type="button" className={'lp-mode'+(mode===value?' selected':'')} onClick={()=>onChange(mode)} aria-pressed={mode===value}><i className={'fa-solid '+modes[mode].icon} aria-hidden="true"/><strong>{modes[mode].title}</strong><small>{modes[mode].summary}</small><b>{modes[mode].trait}</b></button>)}</div>}
export function PlanningModal({title,kicker,subtitle,onClose,children,footer,stepValidations=[]}){
 const [active,setActive]=useState(0);
 const [furthest,setFurthest]=useState(0);
 const childrenArray=React.Children.toArray(children);
 const stages=childrenArray.filter(child=>React.isValidElement(child)&&child.type===Step);
 const extra=childrenArray.filter(child=>!React.isValidElement(child)||child.type!==Step);
 const total=stages.length;
 const index=Math.min(active,Math.max(0,total-1));
 const hasWizard=total>1;
 const atEnd=!hasWizard||index===total-1;
 const allowed=stepValidations[index]!==false;
 const advance=()=>{
  if(!allowed||atEnd)return;
  setActive(index+1);setFurthest(previous=>Math.max(previous,index+1));
 };
 const retreat=()=>setActive(Math.max(0,index-1));
 return <div className="freight-itinerary-backdrop lp-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <section className="lp-modal" role="dialog" aria-modal="true" aria-label={title}>
   <header className="lp-head"><div><span className="lp-eyebrow">{kicker}</span><h2>{title}</h2><p>{subtitle}</p></div><button type="button" className="lp-dismiss" onClick={onClose} aria-label="Close planner"><i className="fa-solid fa-xmark"/></button></header>
   {hasWizard&&<nav className="lp-wizard-nav" aria-label="Planning steps">
    <div className="lp-wizard-count">STAGE {String(index+1).padStart(2,'0')} <span>/ {String(total).padStart(2,'0')}</span></div>
    <div className="lp-wizard-track">{stages.map((stage,i)=><button type="button" key={stage.key||i} className={'lp-wizard-stop'+(i===index?' is-current':'')+(i<index?' is-complete':'')} aria-current={i===index?'step':undefined} disabled={i>furthest} onClick={()=>setActive(i)} title={stage.props.title}><span>{String(i+1).padStart(2,'0')}</span><small>{stage.props.title}</small></button>)}</div>
   </nav>}
   <div className="lp-content lp-wizard-content" aria-live="polite" aria-atomic="false">{total?stages[index]:children}{atEnd&&extra}</div>
   {(hasWizard||footer)&&<footer className="lp-footer lp-wizard-footer">
    {hasWizard&&<div className="lp-wizard-actions"><button type="button" disabled={index===0} onClick={retreat}><i className="fa-solid fa-arrow-left" aria-hidden="true"/> Back</button><span>Step {index+1} of {total}</span></div>}
    <div className="lp-wizard-primary">{atEnd?footer:<button type="button" className="freight-primary" disabled={!allowed} onClick={advance}>Next <i className="fa-solid fa-arrow-right" aria-hidden="true"/></button>}</div>
   </footer>}
  </section>
 </div>;
}
export function Step({number,title,subtitle,children}){return <section className="lp-step"><div className="lp-step-label"><span>{String(number).padStart(2,'0')}</span><div><h3>{title}</h3>{subtitle&&<p>{subtitle}</p>}</div></div><div className="lp-step-body">{children}</div></section>}
export function Picker({label,value,onChange,options=[],placeholder='Search locations…',empty='No available choices',disabled=false}){const [search,setSearch]=useState('');const chosen=options.find(x=>String(x.value)===String(value));return <div className="lp-picker"><span className="lp-picker-label">{label}</span><input type="search" aria-label={'Search '+label} placeholder={placeholder} value={search} disabled={disabled} onChange={e=>setSearch(e.target.value)}/><div className="lp-picker-choices" role="group" aria-label={label}>{chosen&&!options.some(x=>String(x.value)===String(chosen.value))&&null}{options.filter(o=>(o.label+' '+(o.detail||'')).toLowerCase().includes(search.toLowerCase())).slice(0,35).map(o=><button type="button" key={o.value} disabled={disabled||o.disabled} aria-pressed={String(value)===String(o.value)} className={'lp-choice'+(String(value)===String(o.value)?' selected':'')} onClick={()=>onChange(String(o.value))}><i className="fa-solid fa-location-dot" aria-hidden="true"/><span><strong>{o.label}</strong>{o.detail&&<small>{o.detail}</small>}</span>{String(value)===String(o.value)&&<i className="fa-solid fa-circle-check" aria-hidden="true"/>}</button>)}{!options.filter(o=>(o.label+' '+(o.detail||'')).toLowerCase().includes(search.toLowerCase())).length&&<div className="lp-empty">{empty}</div>}</div></div>}
export function RouteChain({stops,mode}){return <div className="lp-chain" aria-label="Planned route">{stops.map((stop,index)=><React.Fragment key={index}>{index>0&&<span className="lp-chain-link"><i className={'fa-solid '+(modes[mode]?.icon||'fa-arrow-right')}/></span>}<span className={'lp-chain-node'+(stop?'':' is-empty')}><i className="fa-solid fa-location-dot" aria-hidden="true"/>{stop||'Choose location'}</span></React.Fragment>)}</div>}
export function Requirement({icon='fa-box',label,value,warning=false}){return <div className={'lp-requirement'+(warning?' warn':'')}><i className={'fa-solid '+icon}/><span>{label}</span><strong>{value}</strong></div>}
