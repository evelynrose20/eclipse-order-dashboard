import React,{useState} from 'react';
const label=s=>String(s||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
export default function LogisticsTradeTreaties({request,data,onRefresh}){
 const [draft,setDraft]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const factions=data.factions||[],treaties=data.treaties||[];
 async function act(path,body){setBusy(true);setError('');try{await request(path,{method:'POST',body});setDraft(null);await onRefresh()}catch(e){setError(e.message||'Treaty not approved')}finally{setBusy(false)}}
 return <section className="freight-list"><div className="freight-list-head"><div><h3>Trade diplomacy & border access</h3><small>Transport across another faction's territory requires an authorized treaty and supportive diplomatic relations.</small></div><button onClick={()=>setDraft({faction_a:'',faction_b:'',purpose:'trade',notes:''})}>+ Propose agreement</button></div>
 {error&&<p className="wa-error" role="alert">{error}</p>}
 {treaties.map(t=><article className="freight-row" key={t.id}><div><span className={'freight-status is-'+t.status}>{label(t.status)} · {label(t.purpose)}</span><strong>{t.faction_a_name} ↔ {t.faction_b_name}</strong><small>{t.notes||'Border trade and supply access'}</small></div><div className="freight-row-actions">{['proposed','suspended'].includes(t.status)&&<button disabled={busy} onClick={()=>act('/world-admin/logistics/treaties/'+t.id+'/status',{status:'active'})}>Ratify treaty</button>}{t.status==='active'&&<button disabled={busy} onClick={()=>act('/world-admin/logistics/treaties/'+t.id+'/status',{status:'suspended'})}>Suspend trade</button>}{t.status!=='retired'&&<button disabled={busy} onClick={()=>act('/world-admin/logistics/treaties/'+t.id+'/status',{status:'retired'})}>Retire</button>}</div></article>)}
 {!treaties.length&&<p className="freight-empty">No diplomatic transport access agreements have been proposed.</p>}
 {draft&&<div className="freight-overlay"><section role="dialog" aria-modal="true" aria-label="Propose transport treaty" className="freight-modal"><header><h3>Propose trade treaty</h3><button onClick={()=>setDraft(null)}>Close</button></header><div className="freight-form">
 <label>First faction<select value={draft.faction_a} onChange={e=>setDraft({...draft,faction_a:e.target.value})}><option value="">Select faction</option>{factions.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
 <label>Second faction<select value={draft.faction_b} onChange={e=>setDraft({...draft,faction_b:e.target.value})}><option value="">Select faction</option>{factions.filter(f=>f.id!==draft.faction_a).map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
 <label>Agreement purpose<select value={draft.purpose} onChange={e=>setDraft({...draft,purpose:e.target.value})}>{['trade','relief','military','industry'].map(p=><option key={p} value={p}>{label(p)}</option>)}</select></label>
 <label>Terms and conditions<textarea value={draft.notes} maxLength={600} rows={3} onChange={e=>setDraft({...draft,notes:e.target.value})}/></label>
 <p className="freight-hint">Ratification requires at least 40 diplomatic trust and no more than 65 tension. Agreements do not create goods or transport vehicles.</p>
 <footer><button onClick={()=>setDraft(null)}>Cancel</button><button disabled={busy||!draft.faction_a||!draft.faction_b} onClick={()=>act('/world-admin/logistics/treaties',draft)}>Submit proposal</button></footer>
 </div></section></div>}
 </section>;
}
