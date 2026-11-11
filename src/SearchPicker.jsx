import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import './SearchPicker.css';

/** Controlled, searchable single choice; options: {id,name,category?,description?}. */
export default function SearchPicker({value='',onChange,options=[],placeholder='Choose an item',ariaLabel,disabled=false,required=false,groupByCategory=true,portal=false}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[active,setActive]=useState(0),[position,setPosition]=useState(null);
 const root=useRef(null),popover=useRef(null),search=useRef(null);
 const normalized=useMemo(()=>options.map(o=>({id:String(o.id??o.value??''),name:String(o.name??o.label??''),category:String(o.category??o.group??''),description:String(o.description??'')})),[options]);
 const current=normalized.find(o=>o.id===String(value));
 const filtered=useMemo(()=>{const q=query.trim().toLocaleLowerCase();return normalized.filter(o=>!q||[o.name,o.category,o.description,o.id].some(v=>v.toLocaleLowerCase().includes(q))).sort((a,b)=>a.name.localeCompare(b.name))},[normalized,query]);
 const positionPopup=useCallback(()=>{
  if(!portal||!root.current)return;
  const box=root.current.getBoundingClientRect();
  const margin=12,below=window.innerHeight-box.bottom-margin,above=box.top-margin;
  const flip=below<250&&above>below;
  const height=Math.min(330,Math.max(110,flip?above:below));
  const width=Math.min(Math.max(box.width,340),window.innerWidth-margin*2);
  const left=Math.max(margin,Math.min(box.left,window.innerWidth-width-margin));
  const top=flip?Math.max(margin,box.top-height-6):Math.max(margin,Math.min(window.innerHeight-height-margin,box.bottom+6));
  setPosition({top,left,width,maxHeight:height});
 },[portal]);
 useEffect(()=>{
  if(!open)return;
  positionPopup();
  search.current?.focus();
  const outside=e=>{if(!root.current?.contains(e.target)&&!popover.current?.contains(e.target))setOpen(false)};
  document.addEventListener('pointerdown',outside);
  if(portal){window.addEventListener('resize',positionPopup);window.addEventListener('scroll',positionPopup,true)}
  return()=>{
   document.removeEventListener('pointerdown',outside);
   if(portal){window.removeEventListener('resize',positionPopup);window.removeEventListener('scroll',positionPopup,true)}
  };
 },[open,portal,positionPopup]);
 useEffect(()=>{if(open&&(!portal||position))search.current?.focus()},[open,portal,position]);
 useEffect(()=>setActive(0),[query,open]);
 const choose=id=>{onChange(id);setOpen(false);setQuery('')};
 const groups=groupByCategory?Object.entries(Object.groupBy?Object.groupBy(filtered,o=>o.category||'Other'):filtered.reduce((acc,o)=>{(acc[o.category||'Other']??=[]).push(o);return acc},{}))):[['',filtered]];
 const popup=<div ref={popover} className={'eo-search-popover'+(portal?' eo-search-popover-portaled':'')} style={portal&&position?position:undefined}>
  <input ref={search} type="search" value={query} aria-label={'Search '+(ariaLabel||placeholder)} placeholder="Type to search…" onChange={e=>setQuery(e.target.value)}
   onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();setOpen(false)}if(e.key==='ArrowDown'){e.preventDefault();setActive(i=>Math.min(filtered.length-1,i+1))}if(e.key==='ArrowUp'){e.preventDefault();setActive(i=>Math.max(0,i-1))}if(e.key==='Enter'&&filtered[active]){e.preventDefault();choose(filtered[active].id)}}}/>
  <div className="eo-search-results" role="listbox" aria-label={ariaLabel||placeholder}>
   {!filtered.length&&<p className="eo-search-empty">No matching results.</p>}
   {groups.map(([group,items])=><React.Fragment key={group}>{groupByCategory&&<div className="eo-search-group">{group}</div>}{items.map(item=><button type="button" role="option" aria-selected={item.id===String(value)} key={item.id} className={'eo-search-option'+(filtered[active]?.id===item.id?' focused':'')} onMouseEnter={()=>setActive(filtered.indexOf(item))} onClick={()=>choose(item.id)}><span>{item.name}{item.description&&<small>{item.description}</small>}</span>{item.id===String(value)&&<b aria-hidden="true">✓</b>}</button>)}</React.Fragment>)}
  </div><div className="eo-search-count">{filtered.length} of {normalized.length} results</div>
 </div>;
 return <div className="eo-search-picker" ref={root}>
  <button type="button" className={'eo-search-trigger'+(open?' is-open':'')} aria-label={ariaLabel||placeholder} aria-haspopup="listbox" aria-expanded={open} disabled={disabled} onClick={()=>{setQuery('');setOpen(v=>!v)}}>
   <span className={current?'':'eo-search-placeholder'}>{current?.name||(value?'Unavailable: '+value:placeholder)}</span><span aria-hidden="true">⌄</span>
  </button>
  {required&&<input className="eo-search-validation" tabIndex={-1} required value={value||''} onChange={()=>{}} aria-hidden="true"/>}
  {open&&(portal?(position?createPortal(popup,document.body):null):popup)}
 </div>;
}
