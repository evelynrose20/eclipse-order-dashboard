import React,{useState} from 'react';
import SiteIcon,{SITE_MARKER_OPTIONS,markerIconName} from './SiteIcon.jsx';
import './site-marker-picker.css';

export default function SiteMarkerPicker({value='settlement',onChange,disabled=false}){
 const [open,setOpen]=useState(false),[search,setSearch]=useState(''),[custom,setCustom]=useState('');
 const options=SITE_MARKER_OPTIONS.filter(([id,label,icon])=>(id+' '+label+' '+icon).toLowerCase().includes(search.toLowerCase()));
 const selected=SITE_MARKER_OPTIONS.find(([id])=>id===value);
 const rawIcon=custom.trim().toLowerCase().replace(/^fa-solid\s+/,'').replace(/^fa-/,'');
 const customValid=/^[a-z0-9-]{1,29}$/.test(rawIcon);
 return <div className="eo-marker-picker">
  <button type="button" className="eo-marker-trigger" disabled={disabled} aria-expanded={open} onClick={()=>setOpen(v=>!v)}>
   <SiteIcon name={markerIconName(value)}/><span>{selected?.[1]||value}</span><i className={'fa-solid '+(open?'fa-chevron-up':'fa-chevron-down')}/>
  </button>
  {open&&<div className="eo-marker-menu">
   <input autoFocus type="search" aria-label="Search site icons" value={search} placeholder="Find lumberyard, mine, rail, sawmill…" onChange={e=>setSearch(e.target.value)}/>
   <div className="eo-marker-grid" role="group" aria-label="Select a map marker icon">
    {options.map(([id,label,icon])=><button key={id} type="button" className={value===id?'active':''} aria-pressed={value===id} onClick={()=>{onChange(id);setOpen(false);setSearch('')}}><SiteIcon name={icon}/><span>{label}</span></button>)}
   </div>
   {!options.length&&<p>No matching built-in categories. You can use a Font Awesome icon name below.</p>}
   <div className="eo-marker-custom">
    <label>Other Font Awesome Free Solid icon
     <input placeholder="e.g. fa-tree or fa-train" value={custom} maxLength={38} onChange={e=>setCustom(e.target.value)}/>
    </label>
    <button type="button" disabled={!customValid} onClick={()=>{onChange('fa-'+rawIcon);setOpen(false);setCustom('')}}>
     {customValid&&<SiteIcon name={rawIcon}/>} Use icon
    </button>
    <a href="https://fontawesome.com/search?ic=free" rel="noopener noreferrer" target="_blank">Browse the Font Awesome icon catalog</a>
   </div>
  </div>}
 </div>;
}
