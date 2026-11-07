import React,{useState} from 'react';
import SiteIcon,{SITE_MARKER_OPTIONS,markerIconName} from './SiteIcon.jsx';
import './site-marker-picker.css';

export default function SiteMarkerPicker({value='settlement',onChange,disabled=false}){
 const [open,setOpen]=useState(false),[search,setSearch]=useState('');
 const selected=SITE_MARKER_OPTIONS.find(([id])=>id===value);
 const matching=SITE_MARKER_OPTIONS.filter(([id,label])=>(id+' '+label).toLowerCase().includes(search.toLowerCase()));
 return <div className="eo-marker-picker">
  <button type="button" className="eo-marker-picker-trigger" disabled={disabled} aria-expanded={open} onClick={()=>setOpen(p=>!p)}>
   <SiteIcon name={markerIconName(value)} size={19}/><span>{selected?.[1]||value}</span><span aria-hidden="true">{open?'▴':'▾'}</span>
  </button>
  {open&&<div className="eo-marker-picker-panel">
   <input autoFocus type="search" aria-label="Find a marker icon" placeholder="Search settlement, industry, military, transport…" value={search} onChange={e=>setSearch(e.target.value)}/>
   <div className="eo-marker-picker-grid" role="group" aria-label="Available map marker icons">
    {matching.map(([id,label,icon])=><button key={id} type="button" title={label} aria-pressed={value===id} className={value===id?'active':''} onClick={()=>{onChange(id);setOpen(false);setSearch('')}}>
     <SiteIcon name={icon} size={21}/><span>{label}</span>
    </button>)}
   </div>
   {!matching.length&&<p>No matching marker. Search another term.</p>}
   <div className="eo-marker-picker-footer"><small>Shared Eclipse Order icon catalog</small><button type="button" onClick={()=>setOpen(false)}>Close</button></div>
  </div>}
 </div>;
}
