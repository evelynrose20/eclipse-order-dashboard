import React,{useState} from 'react';
import './map-icon-picker.css';

// Icons are Font Awesome CSS/web-font glyphs, not SVG components.
export default function MapIconPicker({options=[],value,onChange,disabled=false,label='Map marker icon'}){
 const [open,setOpen]=useState(false);
 const active=options.find(o=>o[0]===value)||options[0];
 return <div className="map-icon-picker">
  <span className="map-icon-picker-label">{label}</span>
  <button type="button" className="map-icon-picker-trigger" aria-expanded={open} disabled={disabled} onClick={()=>setOpen(o=>!o)}>
   <i className={'fa-solid fa-'+(active?.[2]||'location-dot')} aria-hidden="true"/>
   <span>{active?.[1]||'Select marker'}</span>
   <i className={'fa-solid fa-chevron-'+(open?'up':'down')} aria-hidden="true"/>
  </button>
  {open&&<div className="map-icon-picker-grid" role="group" aria-label="Marker categories">
   {options.map(([id,name,glyph])=><button type="button" key={id} disabled={disabled} className={id===value?'selected':''} aria-pressed={id===value} onClick={()=>{onChange(id);setOpen(false)}}>
     <i className={'fa-solid fa-'+glyph} aria-hidden="true"/><span>{name}</span>
    </button>)}
  </div>}
 </div>;
}
