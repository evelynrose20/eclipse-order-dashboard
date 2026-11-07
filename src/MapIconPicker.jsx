import React,{useState} from 'react';
import './map-icon-picker.css';

// Shared Font Awesome 6 Free Solid icon picker. The site already loads the
// library globally. Store the existing category ID or a validated fa-* name.
export const iconNameFor=(value,options=[])=>{
 const match=options.find(([id])=>id===value);
 if(match)return match[2];
 return /^fa-[a-z0-9-]{1,29}$/.test(value||'')?value.slice(3):'location-dot';
};
export const sanitizeFontAwesomeName=value=>{
 const candidate=String(value||'').trim().toLowerCase().replace(/^fa-solid\s+/,'').replace(/^fa-/,'');
 return /^[a-z0-9-]{1,29}$/.test(candidate)?'fa-'+candidate:null;
};

export default function MapIconPicker({options=[],value,onChange,disabled=false,label='Map marker icon'}){
 const [open,setOpen]=useState(false),[search,setSearch]=useState(''),[custom,setCustom]=useState('');
 const active=options.find(o=>o[0]===value);
 const shown=options.filter(([id,name,glyph])=>(id+' '+name+' '+glyph).toLowerCase().includes(search.toLowerCase()));
 const customId=sanitizeFontAwesomeName(custom);
 const choose=id=>{onChange(id);setOpen(false);setSearch('');setCustom('')};
 return <div className="map-icon-picker">
  <span className="map-icon-picker-label">{label}</span>
  <button type="button" className="map-icon-picker-trigger" aria-expanded={open} disabled={disabled} onClick={()=>setOpen(o=>!o)}>
   <i className={'fa-solid fa-'+iconNameFor(value,options)} aria-hidden="true"/>
   <span>{active?.[1]||value||'Select marker'}</span>
   <i className={'fa-solid fa-chevron-'+(open?'up':'down')} aria-hidden="true"/>
  </button>
  {open&&<div className="map-icon-picker-menu">
   <input className="map-icon-picker-search" type="search" autoFocus aria-label="Search marker icons" placeholder="Search lumberyard, sawmill, rail, factory…" value={search} onChange={e=>setSearch(e.target.value)}/>
   <div className="map-icon-picker-grid" role="group" aria-label="Marker categories">
    {shown.map(([id,name,glyph])=><button type="button" key={id} disabled={disabled} className={id===value?'selected':''} aria-pressed={id===value} onClick={()=>choose(id)}>
     <i className={'fa-solid fa-'+glyph} aria-hidden="true"/><span>{name}</span>
    </button>)}
   </div>
   {!shown.length&&<p className="map-icon-picker-empty">No listed marker matches. Search Font Awesome below for another icon.</p>}
   <div className="map-icon-picker-custom">
    <label>Other Font Awesome Free Solid icon
     <input type="text" placeholder="e.g. fa-tree or fa-train" maxLength={38} value={custom} onChange={e=>setCustom(e.target.value)}/>
    </label>
    <button type="button" disabled={disabled||!customId} onClick={()=>customId&&choose(customId)}>
     {customId&&<i className={'fa-solid fa-'+customId.slice(3)} aria-hidden="true"/>} Use icon
    </button>
    <a href="https://fontawesome.com/search?ic=free" target="_blank" rel="noopener noreferrer">Browse Font Awesome Free icons</a>
   </div>
  </div>}
 </div>;
}
