import React from 'react';
import {TRAIT_NAMES} from './lineageTraits.js';
import FamilyCare from './FamilyCare.jsx';

export const LINEAGE_TABS=[
 ['cases','Research cases','fa-flask'],
 ['traits','Lineage & traits','fa-dna'],
 ['gestation','Lineage gestation','fa-heart-pulse'],
 ['parenthood','Lineage parenthood','fa-people-roof']
];
const title=s=>String(s||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
const traitTitle=id=>TRAIT_NAMES[id]||id;
const passedDays=(anchor,offset)=>anchor?Math.max(0,Number(offset||0)+Math.floor((Date.now()-new Date(String(anchor).slice(0,10)+'T00:00:00Z').getTime())/86400000)):0;
const traitList=(traits,empty='No markers recorded.')=><div className="lineage-markers">{(traits||[]).length?(traits||[]).map(id=><span key={id} className="lineage-marker">{traitTitle(id)}</span>):<span className="lineage-muted">{empty}</span>}</div>;
function CaseHead({entry,actions}){
 return <div className="lineage-card-head"><div><small>{entry.character_name||'Unlinked research case'} · {title(entry.result)}</small><h4>{entry.designation}</h4></div>{actions}</div>;
}
export default function LineageViews({cases=[],tab='cases',onTab=()=>{},onManage,onConceive,request,readOnly=false,staff=false}){
 const gestures=cases.filter(c=>c.pregnancy_linked||c.lineage_type==='voidsent'||c.may_conceive);
 const parents=cases.filter(c=>c.offspring_stage&&c.offspring_stage!=='not_recorded');
 return <div className="lineage-workspace">
  <nav className="lineage-tabs" aria-label="Imperial Lineage sections">
   {LINEAGE_TABS.map(([id,label,icon])=><button key={id} type="button" aria-current={tab===id?'page':undefined} className={tab===id?'selected':''} onClick={()=>onTab(id)}><i className={'fa-solid '+icon} aria-hidden="true"/> {label}</button>)}
  </nav>
  {tab==='cases'&&<div className="lineage-view-cards">{cases.map(entry=><article className="lineage-record" key={entry.id}>
   <CaseHead entry={entry} actions={staff&&onManage?<button type="button" onClick={()=>onManage(entry)}>Manage</button>:null}/>
   <p>{entry.participant_note||entry.lineage_markers||'No participant observations recorded.'}</p>
   {staff&&entry.method&&<small className="lineage-muted">Research method: {entry.method}</small>}
   {entry.pregnancy_linked&&<span className="lineage-mini-status">Gestation linked</span>}
  </article>)}{!cases.length&&<p className="lineage-empty">No linked research records are available here.</p>}</div>}
  {tab==='traits'&&<div className="lineage-view-cards">{cases.map(entry=><article className="lineage-record" key={entry.id}>
   <CaseHead entry={entry} actions={staff&&onManage?<button type="button" onClick={()=>onManage(entry)}>Edit traits</button>:null}/>
   <div className="lineage-info-grid">
    <div><small>Research classification</small><strong>{entry.lineage_type==='voidsent'?'Voidsent lineage':entry.lineage_type==='undisclosed'?'Unclassified': 'Standard lineage'}</strong></div>
    <div><small>Subject assignment</small><strong>{title(entry.subject_role||'carrier')}</strong></div>
    <div><small>Physical / aetheric expression</small><strong>{title(entry.expression_stage||'none')}</strong></div>
   </div>
   {traitList(entry.traits)}
   <p>{entry.participant_note||entry.lineage_markers||'No observed changes recorded.'}</p>
  </article>)}{!cases.length&&<p className="lineage-empty">Linked character observations will appear here after the researcher records them.</p>}</div>}
  {tab==='gestation'&&<div className="lineage-view-cards">{gestures.map(entry=>{
    const active=entry.pregnancy_status==='active';
    const days=active?passedDays(entry.pregnancy_anchor,entry.pregnancy_start_day):0;
    const total=Number(entry.pregnancy_total_days||90);
    const percent=Math.min(100,Math.round(100*days/Math.max(1,total)));
    return <article className="lineage-record" key={entry.id}><CaseHead entry={entry}/>
      <div className="lineage-info-grid"><div><small>Lineage gestation</small><strong>{active?'Active pregnancy':'No active pregnancy'}</strong></div>
      <div><small>{total===4?'Accelerated term':'Tracking'}</small><strong>{active&&entry.pregnancy_anchor?days+' / '+total+' IC days':'Existing character record'}</strong></div></div>
      {active&&entry.pregnancy_anchor&&<div className="lineage-progress" aria-label={'Gestation '+percent+' percent'}><span style={{width:percent+'%'}}/></div>}
      <p>{entry.conception_origin==='lineage'?'Lineage trial conception — recorded against this case.':entry.conception_origin==='linked_existing'?'An existing pregnancy was associated with this case.':'This research view uses the ordinary consent-controlled conception rules, while tracking the lineage outcome separately.'}</p>
      <p>{entry.participant_note||'No lineage-specific gestation observations recorded.'}</p>
      {onConceive&&entry.may_conceive&&!active&&<div className="lineage-action-row"><button type="button" onClick={()=>onConceive(entry)}><i className="fa-solid fa-dice-d20" aria-hidden="true"/> Record lineage conception</button></div>}
    </article>
  })}{!gestures.length&&<p className="lineage-empty">No research cases are linked to an active pregnancy. The normal pregnancy system remains separate.</p>}</div>}
  {tab==='parenthood'&&<div className="lineage-view-cards">{parents.map(entry=><article className="lineage-record" key={entry.id}>
    <CaseHead entry={entry} actions={staff&&onManage?<button type="button" onClick={()=>onManage(entry)}>Edit parenthood</button>:null}/>
    <div className="lineage-info-grid"><div><small>Lineage outcome</small><strong>{title(entry.offspring_stage)}</strong></div>
      <div><small>Stability</small><strong>{entry.lineage_type==='voidsent'?'Voidsent heritage study':'Lineage study'}</strong></div></div>
    <h5>Anticipated / documented hereditary markers</h5>
    {traitList(entry.offspring_traits,entry.lineage_type==='undisclosed'?'Hereditary markers have not been disclosed.':'No hereditary markers recorded.')}
    <p>{entry.parenthood_note||'No lineage-specific parenthood observations recorded.'}</p>
    <small className="lineage-muted">Parenthood records do not create a child character or add anyone to adult character systems.</small>
   </article>)}{!parents.length&&<p className="lineage-empty">No lineage parenthood findings have been recorded yet.</p>}
   {request&&parents.some(c=>c.offspring_stage==='documented')&&<FamilyCare request={request} lineageCaseId={parents.find(c=>c.offspring_stage==='documented').id} compact readOnly={readOnly}/>}
  </div>}
 </div>;
}
