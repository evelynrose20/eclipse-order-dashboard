import React,{useEffect,useState} from 'react';

export default function ContributionPreferences({character,request,userId,readOnly=false}){
 const [data,setData]=useState(null);
 const [draft,setDraft]=useState(null);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const [enhancementBusy,setEnhancementBusy]=useState(false);
 const url='/thralls/characters/'+character.id+'/contributions';
 useEffect(()=>{
  let active=true;
  setData(null);setDraft(null);setError('');
  request(url).then(result=>{if(active){setData(result);setDraft({...result.preferences})}}).catch(e=>{if(active)setError(e.message)});
  return()=>{active=false};
 },[character.id]);
 const editable=Boolean(data?.can_edit&&!readOnly&&character.player_user_id===userId);
 const canManageEnhancements=Boolean(data?.can_manage_enhancements&&!readOnly);
 const upperTiers=[0,24,30,40,50],lowerTiers=[6,8,10,14,18];
 const upperBase=draft?.lactation_state==='established'?18:draft?.lactation_state==='variable'?8:0;
 const lowerBase=draft?.lower_anatomy&&draft.lower_anatomy!=='unspecified'?6:0;
 const upperCapacity=upperBase?(Number(draft.upper_enhancement||0)?upperTiers[Number(draft.upper_enhancement)]:upperBase):0;
 const lowerCapacity=lowerBase?(lowerTiers[Number(draft.lower_enhancement||0)]||6):0;
 const toggle=(key,value)=>setDraft(old=>({...old,[key]:value}));
 async function saveEnhancements(){
  if(!canManageEnhancements)return;
  setEnhancementBusy(true);setError('');setNotice('');
  try{
   const payload={upper_enhancement:Number(draft.upper_enhancement||0),lower_enhancement:Number(draft.lower_enhancement||0)};
   await request(url+'/enhancements',{method:'PUT',body:payload});
   setData(old=>({...old,preferences:{...old.preferences,...payload}}));
   setNotice('Both production enhancement levels saved.');
  }catch(e){setError(e.message||'Unable to save enhancements.')}
  finally{setEnhancementBusy(false)}
 }
 async function save(e){
  e.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   const body={
    allow_seating:!!draft.allow_seating,
    gender_identity:draft.gender_identity||'unspecified',
    lower_anatomy:draft.lower_anatomy||'unspecified',
    lactation_state:draft.lactation_state||'none'
   };
   await request(url,{method:'PUT',body});
   setData(old=>({...old,preferences:body}));
   setNotice('Contribution permissions saved.');
  }catch(e){setError(e.message||'Unable to save permissions.')}
  finally{setBusy(false)}
 }
 return <section className="dossier-chapter">
  <div className="dossier-chapter-head"><span>CHARACTER / CHAMBER</span><h3>Contribution permissions</h3><p>Configure the character's anatomy and lactation state. Collection availability and output are calculated automatically.</p></div>
  {error&&<p className="alert" role="alert">{error}</p>}
  {notice&&<p role="status">{notice}</p>}
  {!draft&&!error&&<p>Loading character permissions…</p>}
  {draft&&<form onSubmit={save} style={{display:'grid',gap:16,maxWidth:720}}>
   <div className="panel" style={{display:'grid',gap:12}}>
    <strong>Character gender and anatomy</strong>
    <p className="muted">Gender and anatomy are configured separately.</p>
    <label style={{display:'grid',gap:6}}>Gender identity
     <select value={draft.gender_identity||'unspecified'} disabled={!editable} onChange={e=>toggle('gender_identity',e.target.value)}>
      <option value="unspecified">Not specified</option><option value="female">Female</option><option value="male">Male</option><option value="nonbinary">Nonbinary</option><option value="other">Other / fantasy</option>
     </select>
    </label>
    <label style={{display:'grid',gap:6}}>Lower anatomy
     <select value={draft.lower_anatomy||'unspecified'} disabled={!editable} onChange={e=>toggle('lower_anatomy',e.target.value)}>
      <option value="unspecified">Not specified</option><option value="vulva">Vulva / vaginal</option><option value="penis">Penis / seminal</option><option value="mixed">Both / mixed anatomy</option><option value="other">Other / fantasy anatomy</option>
     </select>
    </label>
    <p className="muted">The lower assembly uses this selection to determine its collection category.</p>
   </div>
   <label style={{display:'flex',gap:10,alignItems:'center'}}><input type="checkbox" checked={!!draft.allow_seating} disabled={!editable} onChange={e=>toggle('allow_seating',e.target.checked)}/><strong>Allow chamber seating</strong></label>
   <div className="panel" style={{display:'grid',gap:10}}>
    <strong>Production profile</strong>
    <label style={{display:'grid',gap:6}}>Lactation state
     <select value={draft.lactation_state||'none'} disabled={!editable} onChange={e=>toggle('lactation_state',e.target.value)}>
      <option value="none">Not lactating</option><option value="established">Established lactation</option><option value="variable">Variable lactation</option>
     </select>
    </label>
    <div className="dossier-fields">
     <p><strong>Upper assembly:</strong> {draft.lactation_state&&draft.lactation_state!=='none'?'Physiologically available':'No lactation'}</p>
     <p><strong>Lower assembly:</strong> {draft.lower_anatomy&&draft.lower_anatomy!=='unspecified'?'Categorized from anatomy':'Anatomy not configured'}</p>
    </div>
    <small>Output is determined by timed cycles and the character's production profile. Some cycles may produce nothing.</small>
   </div>
   <div className="panel" style={{display:'grid',gap:12}}>
    <strong>Daily production enhancements</strong>
    <p className="muted">Optional RP enhancements increase each assembly's daily capacity, not its extraction speed. The two reservoirs are independent. Only staff can assign a tier.</p>
    <div className="dossier-fields">
     <label style={{display:'grid',gap:6}}>Lacteal Reservoir
      <select value={draft.upper_enhancement||0} disabled={!canManageEnhancements||enhancementBusy} onChange={e=>toggle('upper_enhancement',Number(e.target.value))}>
       <option value={0}>Normal (character baseline)</option>
       {upperTiers.slice(1).map((n,i)=><option key={n} value={i+1}>{['Minor','Moderate','Major','Exceptional'][i]} — {n.toFixed(1)} units/day</option>)}
      </select>
     </label>
     <label style={{display:'grid',gap:6}}>Secondary Reservoir
      <select value={draft.lower_enhancement||0} disabled={!canManageEnhancements||enhancementBusy} onChange={e=>toggle('lower_enhancement',Number(e.target.value))}>
       <option value={0}>Normal — 6.0 units/day</option>
       {lowerTiers.slice(1).map((n,i)=><option key={n} value={i+1}>{['Minor','Moderate','Major','Exceptional'][i]} — {n.toFixed(1)} units/day</option>)}
      </select>
     </label>
    </div>
    <p className="muted">Current daily capacity: Lacteal {upperCapacity.toFixed(1)} · Secondary {lowerCapacity.toFixed(1)} fluid units. Unavailable anatomy or lactation still produces 0.</p>
    {canManageEnhancements?<button type="button" className="btn" disabled={enhancementBusy||busy} onClick={saveEnhancements}>{enhancementBusy?'Saving…':'Save enhancement levels'}</button>:<small className="muted">Production tiers are controlled by authorized staff.</small>}
   </div>
   {editable?<button type="submit" className="btn primary" disabled={busy}>{busy?'Saving…':'Save permissions'}</button>:<p className="muted">Read-only. Only this character's player can change contribution permissions.</p>}
   <p className="muted">Seating defaults to disabled. Turning it off releases the character and stops the apparatus.</p>
  </form>}
 </section>;
}
