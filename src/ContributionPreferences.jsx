import React,{useEffect,useState} from 'react';

export default function ContributionPreferences({character,request,userId,readOnly=false}){
 const [data,setData]=useState(null);
 const [draft,setDraft]=useState(null);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const url='/thralls/characters/'+character.id+'/contributions';
 useEffect(()=>{
  let active=true;
  setData(null);setDraft(null);setError('');
  request(url).then(result=>{if(active){setData(result);setDraft({...result.preferences})}}).catch(e=>{if(active)setError(e.message)});
  return()=>{active=false};
 },[character.id]);
 const editable=Boolean(data?.can_edit&&!readOnly&&character.player_user_id===userId);
 const toggle=(key,value)=>setDraft(old=>({...old,[key]:value}));
 async function save(e){
  e.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   const body={
    allow_seating:!!draft.allow_seating,
    allow_upper:!!draft.allow_upper,
    allow_lower:!!draft.allow_lower,
    upper_limit:Number(draft.upper_limit),
    lower_limit:Number(draft.lower_limit),
    gender_identity:draft.gender_identity||'unspecified',
    lower_anatomy:draft.lower_anatomy||'unspecified'
   };
   await request(url,{method:'PUT',body});
   setData(old=>({...old,preferences:body}));
   setNotice('Contribution permissions saved.');
  }catch(e){setError(e.message||'Unable to save permissions.')}
  finally{setBusy(false)}
 }
 return <section className="dossier-chapter">
  <div className="dossier-chapter-head"><span>CHARACTER / CHAMBER</span><h3>Contribution permissions</h3><p>Choose which fictional materials your character may provide, their maximum recorded units per seating, and whether they may be assigned to the chamber. These settings are controlled by the character's player.</p></div>
  {error&&<p className="alert" role="alert">{error}</p>}
  {notice&&<p role="status">{notice}</p>}
  {!draft&&!error&&<p>Loading character permissions…</p>}
  {draft&&<form onSubmit={save} style={{display:'grid',gap:16,maxWidth:720}}>
   <div className="panel" style={{display:'grid',gap:12}}>
    <strong>Character gender and anatomy</strong>
    <p className="muted">Gender does not determine anatomy or the material type. Both can be chosen independently.</p>
    <label style={{display:'grid',gap:6}}>Gender identity
     <select value={draft.gender_identity||'unspecified'} disabled={!editable} onChange={e=>toggle('gender_identity',e.target.value)}>
      <option value="unspecified">Not specified</option><option value="female">Female</option><option value="male">Male</option><option value="nonbinary">Nonbinary</option><option value="other">Other / fantasy</option>
     </select>
    </label>
    <label style={{display:'grid',gap:6}}>Lower anatomy (fictional collection category)
     <select value={draft.lower_anatomy||'unspecified'} disabled={!editable} onChange={e=>toggle('lower_anatomy',e.target.value)}>
      <option value="unspecified">Not specified</option><option value="vulva">Vulva / vaginal</option><option value="penis">Penis / seminal</option><option value="mixed">Both / mixed anatomy</option><option value="other">Other / fantasy anatomy</option>
     </select>
    </label>
    <p className="muted">The lower unit classifies records as vaginal, seminal, mixed, other, or unclassified using this selection. These are fictional bookkeeping categories, not assumptions about what someone can produce.</p>
   </div>
   <label style={{display:'flex',gap:10,alignItems:'center'}}><input type="checkbox" checked={!!draft.allow_seating} disabled={!editable} onChange={e=>toggle('allow_seating',e.target.checked)}/><strong>Allow chamber seating</strong></label>
   {[['upper','Lacteal collection (breast milk)'],['lower','Secondary biological collection']].map(([key,label])=><div key={key} className="panel" style={{display:'grid',gap:12}}>
    <label style={{display:'flex',alignItems:'center',gap:10}}><input type="checkbox" checked={!!draft['allow_'+key]} disabled={!editable} onChange={e=>toggle('allow_'+key,e.target.checked)}/><strong>{label}</strong></label>
    <label style={{display:'grid',gap:5}}>Maximum fictional units per seating<input type="number" min="0" max="1000" value={draft[key+'_limit']} disabled={!editable||!draft['allow_'+key]} onChange={e=>toggle(key+'_limit',e.target.value)}/></label>
   </div>)}
   {editable?<button type="submit" className="btn primary" disabled={busy}>{busy?'Saving…':'Save permissions'}</button>:<p className="muted">Read-only. Only this character's player can change contribution permissions.</p>}
   <p className="muted">All settings default to disabled. Permission may be withdrawn at any time; withdrawing seating permission automatically releases the character and stops the apparatus. In-character authority cannot override OOC boundaries.</p>
  </form>}
 </section>;
}
