import React,{useEffect,useState} from 'react';

export default function ThrallChamber({request}){
 const [room,setRoom]=useState(null);
 const [error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  request('/thralls/chamber').then(data=>{if(active)setRoom(data)}).catch(e=>{if(active)setError(e.message||'Room unavailable')});
  return()=>{active=false};
 },[]);
 if(error)return <section className="panel" role="alert"><h2>Room unavailable</h2><p>Access to this chamber could not be verified.</p></section>;
 if(!room)return <section className="panel"><p>Opening chamber records…</p></section>;
 return <div className="thrall-chamber">
  <section className="panel"><div className="eyebrow">RESTRICTED · LOWER VAULTS</div><h2>{room.title}</h2><p>{room.description}</p></section>
  <div className="eo-character-grid">{room.areas.map((area,index)=><article className="panel" key={area.name}><div className="eyebrow">STATION {String(index+1).padStart(2,'0')}</div><h3>{area.name}</h3><p>{area.detail}</p></article>)}</div>
  <section className="panel"><h3>Scene boundaries</h3><p>{room.safeguards}</p></section>
 </div>;
}
