import React,{useEffect,useMemo,useState} from 'react';
import {createPortal} from 'react-dom';
import './material-picker.css';

function labelText(child){
 if(typeof child==='string'||typeof child==='number')return String(child);
 if(Array.isArray(child))return child.map(labelText).join('');
 return React.isValidElement(child)?labelText(child.props.children):'';
}
const itemIcon=(name,category='')=>{
 const label=(name+' '+category).toLowerCase();
 if(/grain|produce|fish|livestock|food|berry|vegetable|crop|seed/.test(label))return 'fa-wheat-awn';
 if(/lumber|wood|timber/.test(label))return 'fa-tree';
 if(/ore|ingot|iron|metal|stone|mineral/.test(label))return 'fa-cubes-stacked';
 if(/ceruleum|fuel/.test(label))return 'fa-fire-flame-curved';
 if(/airship|ship|locomotive|railcar|vehicle|armor|weapon|gunship|magitek/.test(label))return 'fa-gears';
 if(/herb|plant|botanical/.test(label))return 'fa-seedling';
 if(/material|component|machine|refined|construction/.test(label))return 'fa-industry';
 return 'fa-box';
};
const human=value=>String(value||'Other').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());

/** Site-wide material and cargo selector. Supports both options arrays and existing option children. */
export default function MaterialPicker({value='',onChange,options,children,catalog:referenceCatalog=[],placeholder='Choose an item',ariaLabel,disabled=false,required=false,groupByCategory=true,showQuantity=true,'aria-label':ariaLabelAttr}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[category,setCategory]=useState('all');
 const catalog=useMemo(()=>{
  const list=Array.isArray(options)?options.map(item=>({
   id:String(item.id??item.value??item.material_id??item.item_id??''),
   name:String(item.name??item.label??'Unnamed item'),
   category:String(item.category??item.group??'Other'),
   description:String(item.description??''),
   quantity:item.quantity??item.stock??null,
   disabled:!!item.disabled
  })):React.Children.toArray(children).filter(child=>React.isValidElement(child)&&child.type==='option').map(child=>({
   id:String(child.props.value??''),name:labelText(child.props.children),category:String(child.props.category??'Other'),
   quantity:child.props.quantity??null,description:'',disabled:!!child.props.disabled
  }));
  const references=new Map(referenceCatalog.map(item=>[String(item.id??item.material_id??item.item_id??''),item]));
  return list.filter(item=>item.id!=='').map(item=>{const original=references.get(item.id);return original?{...item,category:item.category==='Other'?String(original.category??'Other'):item.category,quantity:item.quantity??original.quantity??original.stock??null}:item}).sort((a,b)=>a.name.localeCompare(b.name));
 },[options,children,referenceCatalog]);
 const selected=catalog.find(item=>item.id===String(value));
 const categories=useMemo(()=>[...new Set(catalog.map(item=>item.category))].sort(),[catalog]);
 const matches=catalog.filter(item=>(category==='all'||category===item.category)&&(!query.trim()||[item.name,item.category,item.description,item.id].some(text=>text.toLowerCase().includes(query.trim().toLowerCase()))));
 useEffect(()=>{
  if(!open)return;
  const escape=e=>{if(e.key==='Escape')setOpen(false)};
  document.addEventListener('keydown',escape);
  const previous=document.body.style.overflow;
  document.body.style.overflow='hidden';
  return()=>{document.removeEventListener('keydown',escape);document.body.style.overflow=previous};
 },[open]);
 const choose=id=>{onChange?.(options? id : {target:{value:id}});setOpen(false);setQuery('');setCategory('all')};
 const title=ariaLabel||ariaLabelAttr||placeholder;
 return <div className="eo-material-picker">
  <button type="button" disabled={disabled} aria-label={title} aria-haspopup="dialog" aria-expanded={open} className="eo-material-trigger" onClick={()=>setOpen(true)}>
   <span className="eo-material-trigger-icon"><i className={'fa-solid '+itemIcon(selected?.name||'',selected?.category||'')} aria-hidden="true"/></span>
   <span className="eo-material-trigger-label"><strong>{selected?.name|| (value?'Unknown item: '+value:placeholder)}</strong><small>{selected?human(selected.category):'Open material inventory'}</small></span>
   <i className="fa-solid fa-boxes-stacked" aria-hidden="true"/>
  </button>
  {required&&<input className="eo-material-validation" required value={value??''} onChange={()=>{}} tabIndex={-1} aria-hidden="true"/>}
  {open&&createPortal(<div className="eo-material-mask" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}>
   <section role="dialog" aria-modal="true" aria-label={title} className="eo-material-dialog">
    <header className="eo-material-dialog-head"><div><span>MATERIALS & CARGO INVENTORY</span><h3>{title}</h3><p>Select a good from the Order's existing item catalog.</p></div><button type="button" aria-label="Close material inventory" onClick={()=>setOpen(false)}><i className="fa-solid fa-xmark"/></button></header>
    <div className="eo-material-search"><i className="fa-solid fa-magnifying-glass" aria-hidden="true"/><input autoFocus type="search" aria-label={'Search '+title} placeholder="Search goods, resources, blueprints…" value={query} onChange={e=>setQuery(e.target.value)}/><span>{matches.length} matching</span></div>
    <nav className="eo-material-categories" aria-label="Material categories"><button type="button" className={category==='all'?'selected':''} onClick={()=>setCategory('all')}>All ({catalog.length})</button>{groupByCategory&&categories.map(c=><button type="button" key={c} className={category===c?'selected':''} onClick={()=>setCategory(c)}>{human(c)} ({catalog.filter(x=>x.category===c).length})</button>)}</nav>
    <div className="eo-material-grid" role="group" aria-label="Select an inventory item">{matches.map(item=><button key={item.id} type="button" className={'eo-material-card'+(item.id===String(value)?' selected':'')} disabled={item.disabled} aria-pressed={item.id===String(value)} onClick={()=>choose(item.id)}><span className="eo-material-icon"><i className={'fa-solid '+itemIcon(item.name,item.category)} aria-hidden="true"/></span><span className="eo-material-info"><strong>{item.name}</strong><small>{human(item.category)}</small>{item.description&&<small>{item.description}</small>}</span>{showQuantity&&item.quantity!=null&&<span className="eo-material-stock">{Number(item.quantity).toLocaleString(undefined,{maximumFractionDigits:3})}<small>Available</small></span>}{item.id===String(value)&&<i className="fa-solid fa-circle-check eo-material-checked" aria-hidden="true"/>}</button>)}{!matches.length&&<p className="eo-material-empty">No matching goods. Try another category or search.</p>}</div>
    <footer className="eo-material-footer"><span>{selected?'Selected: '+selected.name:'Choose an item above'}</span><button type="button" onClick={()=>setOpen(false)}>Close</button></footer>
   </section>
  </div>,document.body)}
 </div>;
}
