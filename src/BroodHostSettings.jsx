import React,{useEffect,useState} from 'react';

export default function BroodHostSettings({character,request,userId,readOnly=false}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const url='/thralls/breeding-pit/hosts/'+character.id;
 useEffect(()=>{let mounted=true;setData(null);setError('');setNotice('');
  request(url).then(r=>{if(mounted)setData(r)}).catch(e=>{if(mounted)setError(e.message)});
  return()=>{mounted=false};
 },[character.id]);
 const canEdit=!readOnly&&data?.can_edit&&character.player_user_id===userId;
 async function change(enabled){
  setBusy(true);setError('');setNotice('');
  try{await request(url,{method:'PUT',body:{allow_incubation:enabled}});setData(d=>({...d,allow_incubation:enabled}));setNotice(enabled?'Character registered for Brood Pit incubation projects.':'Character registration disabled; active host incubations cancelled.')}
  catch(e){setError(e.message||'Unable to update brood host settings')}finally{setBusy(false)}
 }
 return <section className="dossier-chapter">
  <div className="dossier-chapter-head"><span>BROOD PIT / CHARACTER RECORD</span><h3>Brood Host Registration</h3><p>Register this bound thrall for monster-egg incubation projects. Brood strains, development stages and hatching records are managed independently in the Breeding Pit.</p></div>
  {error&&<p className="alert" role="alert">{error}</p>}
  {notice&&<p role="status">{notice}</p>}
  {!data&&!error&&<p>Loading host registration…</p>}
  {data&&<div className="panel" style={{display:'grid',gap:14,maxWidth:700}}>
   <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:18}}>
    <div><strong>Available for brood incubation</strong><p className="muted">Staff may assign a registered bound thrall to a single active incubation at a time. The character's player can turn this setting off, automatically cancelling any active hosted project.</p></div>
    <label style={{display:'flex',alignItems:'center',gap:8}}><input aria-label="Allow Brood Pit host incubation" type="checkbox" checked={!!data.allow_incubation} disabled={!canEdit||busy} onChange={e=>change(e.target.checked)}/>{data.allow_incubation?'Enabled':'Disabled'}</label>
   </div>
   {!canEdit&&<small className="muted">Only this character's player can change registration.</small>}
  </div>}
 </section>;
}
