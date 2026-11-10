import React,{useEffect,useState} from 'react';
import './venue-management.css';

const emptyPerson=(category)=>({id:crypto.randomUUID(),name:'',title:'',description:'',image:'',vacancy:false,category});
const API=(import.meta.env.VITE_ECLIPSE_API_URL||'').replace(/\/+$/,'');
const imageSource=value=>!value?'':value.startsWith('/venue/images/')?API+value:value.startsWith('https://')?value:'/venue-images/'+value;
function Picture({src,name}){const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[src]);return <div className="vm-portrait">{src&&!failed?<img alt={name||'Venue portrait'} src={imageSource(src)} onError={()=>setFailed(true)}/>:<span aria-hidden="true"><i className="fa-solid fa-moon"/></span>}</div>}
export default function VenueManagement({request}){
 const [roster,setRoster]=useState(null);
 const [group,setGroup]=useState('staff');
 const [draft,setDraft]=useState(null);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');
 const [uploading,setUploading]=useState(false);
 const load=async()=>{setError('');try{const data=await request('/venue/manage');setRoster(data)}catch(err){setError(err.message)}};
 useEffect(()=>{void load()},[]);
 const entries=roster?.[group]||[];
 const saveRoster=async next=>{
  setBusy(true);setMessage('');setError('');
  try{const result=await request('/venue/manage',{method:'PUT',body:next});setRoster(result);setDraft(null);setMessage('The public venue roster has been updated.')}catch(err){setError(err.message);if(String(err.message).includes('venue_roster_changed'))void load()}
  finally{setBusy(false)}
 };
 const savePerson=async()=>{
  if(!draft?.name?.trim())return setError('Enter a display name.');
  const entry={id:draft.id,name:draft.name.trim(),title:draft.title.trim(),description:draft.description.trim(),image:draft.image.trim(),vacancy:!!draft.vacancy};
  const current=roster[group];
  const exists=current.some(p=>p.id===entry.id);
  await saveRoster({...roster,[group]:exists?current.map(p=>p.id===entry.id?entry:p):[...current,entry]});
 };
 const removePerson=async id=>{
  if(!window.confirm('Remove this listing from the public venue page?'))return;
  await saveRoster({...roster,[group]:entries.filter(p=>p.id!==id)});
 };
 const move=async(index,by)=>{
  const to=index+by;if(to<0||to>=entries.length)return;
  const next=[...entries];[next[index],next[to]]=[next[to],next[index]];
  await saveRoster({...roster,[group]:next});
 };
 const upload=async file=>{
  if(!file)return;
  setError('');
  if(file.size>2000000)return setError('Choose an image smaller than 2 MB.');
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))return setError('Use a JPG, PNG, or WEBP image.');
  setUploading(true);
  try{
   const encoded=await new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result).split(',')[1]);
    reader.onerror=()=>reject(new Error('Could not read the image.'));
    reader.readAsDataURL(file);
   });
   const result=await request('/venue/upload',{method:'POST',body:{data:encoded}});
   setDraft(old=>({...old,image:result.url}));
  }catch(err){setError(err.message)}
  finally{setUploading(false)}
 };
 return <div className="vm-root">
  <div className="vm-head"><div><span className="eyebrow">THE MIDNIGHT ECLIPSE · HOUSEHOLD</span><h2>Public venue roster</h2><p>Manage the faces shown on the venue website. Add someone, change a portrait, or leave a position open for applicants.</p></div><div className="vm-actions"><a href="/venue/people/" target="_blank" rel="noopener noreferrer" className="btn secondary">View public roster <i className="fa-solid fa-arrow-up-right-from-square"/></a><button type="button" className="btn secondary" onClick={()=>void load()}>Refresh</button></div></div>
  {message&&<div className="vm-notice" role="status">{message}</div>}
  {error&&<div className="vm-error" role="alert">{error}</div>}
  {roster&&<><div className="vm-toolbar"><div role="tablist" aria-label="Roster categories"><button type="button" className={group==='staff'?'selected':''} role="tab" aria-selected={group==='staff'} onClick={()=>{setGroup('staff');setDraft(null)}}>Staff <span>{roster.staff.length}</span></button><button type="button" className={group==='thralls'?'selected':''} role="tab" aria-selected={group==='thralls'} onClick={()=>{setGroup('thralls');setDraft(null)}}>Thralls <span>{roster.thralls.length}</span></button></div><button className="btn primary" type="button" disabled={busy} onClick={()=>{setDraft(emptyPerson(group));setError('')}}><i className="fa-solid fa-plus"/> Add listing</button></div>
   <div className="vm-grid">{entries.map((person,index)=><article className="vm-person" key={person.id}><Picture src={person.image} name={person.name}/><div className="vm-person-info"><span className="vm-person-category">{person.vacancy?'OPEN POSITION':group==='staff'?'VENUE STAFF':'HOUSEHOLD'}</span><h3>{person.name}</h3><p className="vm-person-title">{person.title}</p><p className="vm-person-description">{person.description}</p><div className="vm-person-actions"><button disabled={busy} onClick={()=>{setDraft({...person});setError('')}}><i className="fa-solid fa-pen-to-square"/> Edit</button><button disabled={busy||index===0} onClick={()=>void move(index,-1)} aria-label={'Move '+person.name+' earlier'}><i className="fa-solid fa-arrow-up"/></button><button disabled={busy||index===entries.length-1} onClick={()=>void move(index,1)} aria-label={'Move '+person.name+' later'}><i className="fa-solid fa-arrow-down"/></button><button disabled={busy} className="vm-danger" onClick={()=>void removePerson(person.id)}><i className="fa-solid fa-trash"/> Remove</button></div></div></article>)}</div>
   {!entries.length&&<div className="vm-empty">No listings in this section. Add the first one to begin.</div>}</>}
  {!roster&&!error&&<div className="panel"><p>Loading venue listings…</p></div>}
  {draft&&<div className="vm-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy&&!uploading)setDraft(null)}}><div className="vm-dialog" role="dialog" aria-modal="true" aria-labelledby="vm-edit-title"><div className="vm-dialog-head"><div><span className="eyebrow">PUBLIC DIRECTORY · {group.toUpperCase()}</span><h2 id="vm-edit-title">Edit venue listing</h2></div><button type="button" onClick={()=>setDraft(null)} disabled={busy||uploading} aria-label="Close editor"><i className="fa-solid fa-xmark"/></button></div><div className="vm-dialog-body">
   <div className="vm-dialog-image"><Picture src={draft.image} name={draft.name}/><label className="vm-upload"><i className="fa-solid fa-image"/> {uploading?'Uploading image…':'Upload portrait'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading||busy} onChange={event=>void upload(event.target.files?.[0])}/></label><small>JPG, PNG, WEBP · maximum 2 MB. Publicly visible.</small></div>
   <div className="vm-form"><label>Character or position name<input value={draft.name} maxLength={120} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><label>Role / title<input value={draft.title} maxLength={120} onChange={e=>setDraft({...draft,title:e.target.value})}/></label><label>Public description<textarea rows={5} maxLength={900} value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></label><label>Image URL or uploaded filename<input value={draft.image} maxLength={500} placeholder="Upload above, or paste an HTTPS image URL" onChange={e=>setDraft({...draft,image:e.target.value})}/></label><label className="vm-check"><input type="checkbox" checked={!!draft.vacancy} onChange={e=>setDraft({...draft,vacancy:e.target.checked})}/> This is an open recruitment position</label></div>
  </div><div className="vm-dialog-footer"><button className="btn secondary" disabled={busy||uploading} onClick={()=>setDraft(null)}>Cancel</button><button className="btn primary" disabled={busy||uploading||!draft.name.trim()} onClick={()=>void savePerson()}>{busy?'Saving…':'Publish changes'}</button></div></div></div>}
 </div>;
}
