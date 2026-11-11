import React,{useMemo,useState} from 'react';
import './logistics-cargo-picker.css';

const amount=x=>Number(x||0).toLocaleString(undefined,{maximumFractionDigits:3});
const iconFor=(category,name='')=>{
 const key=(category+' '+name).toLowerCase();
 if(/grain|food|fish|livestock|harvest|farm|produce|vegetable|crop|seed/.test(key))return 'fa-wheat-awn';
 if(/lumber|timber|wood/.test(key))return 'fa-tree';
 if(/ore|ingot|iron|metal|mineral|stone/.test(key))return 'fa-cubes-stacked';
 if(/ceruleum|fuel/.test(key))return 'fa-fire-flame-curved';
 if(/airship|gunship|locomotive|railcar|warship|flying fortress|vehicle|colossus|juggernaut|transport/.test(key))return 'fa-gears';
 if(/machine|component|part|magitek|manufactured|equipment/.test(key))return 'fa-industry';
 if(/refined|material|construction/.test(key))return 'fa-layer-group';
 return 'fa-box';
};
const nameCategory=x=>String(x||'Unclassified').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
/** Item-grid selector for freight. Defaults to stocked goods, with an explicit full catalog view. */
export default function LogisticsCargoPicker({items=[],stocks=[],value='',onChange,sourceFacilityId=null,requireStock=false,label='Cargo inventory'}){
 const [search,setSearch]=useState('');
 const [category,setCategory]=useState('all');
 const [showCatalog,setShowCatalog]=useState(false);
 const indexed=useMemo(()=>{
  const totals=new Map();
  for(const row of stocks){
   if(sourceFacilityId!=null&&String(row.facility_id)!==String(sourceFacilityId))continue;
   const id=String(row.item_id);
   totals.set(id,(totals.get(id)||0)+Math.max(0,Number(row.quantity)||0));
  }
  return items.map(item=>({...item,stock:totals.get(String(item.id))||0}));
 },[items,stocks,sourceFacilityId]);
 const available=indexed.filter(item=>item.stock>0);
 const hasStock=available.length>0;
 const visibleCatalog=showCatalog||!hasStock;
 const catalog=visibleCatalog?indexed:(requireStock?available:indexed.filter(item=>item.stock>0));
 const categories=[...new Set(catalog.map(item=>String(item.category||'Other')))].sort((a,b)=>a.localeCompare(b));
 const filtered=catalog.filter(item=>{
  const matchCategory=category==='all'||String(item.category||'Other')===category;
  const query=search.trim().toLowerCase();
  return matchCategory&&(!query||[item.name,item.category,item.id].some(x=>String(x||'').toLowerCase().includes(query)));
 }).sort((a,b)=>(b.stock>0)-(a.stock>0)||String(a.name).localeCompare(String(b.name)));
 const chosen=indexed.find(item=>String(item.id)===String(value));
 return <section className="lp-inventory" aria-label={label}>
  <div className="lp-inventory-head"><div><span className="lp-eyebrow">WAREHOUSE MANIFEST · CARGO STORES</span><h4><i className="fa-solid fa-boxes-stacked" aria-hidden="true"/> {label}</h4><p>{sourceFacilityId?'Showing goods recorded at your selected origin.':'Choose from items already stocked across your industrial network.'}</p></div><div className="lp-inventory-total"><strong>{available.length}</strong><span>Stocked types</span></div></div>
  <div className="lp-inventory-toolbar"><label className="lp-inventory-search"><i className="fa-solid fa-magnifying-glass" aria-hidden="true"/><input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Find food, ore, fuel, equipment…" aria-label={'Search '+label}/></label><button type="button" className={'lp-inventory-toggle'+(visibleCatalog?' selected':'')} aria-pressed={visibleCatalog} onClick={()=>{setShowCatalog(!visibleCatalog);setCategory('all')}}>{visibleCatalog?'Show stocked goods':'Browse all item types'}</button></div>
  <div className="lp-inventory-categories" role="group" aria-label="Cargo categories"><button type="button" className={category==='all'?'selected':''} aria-pressed={category==='all'} onClick={()=>setCategory('all')}>All <span>{catalog.length}</span></button>{categories.map(group=><button type="button" key={group} className={category===group?'selected':''} aria-pressed={category===group} onClick={()=>setCategory(group)}>{nameCategory(group)} <span>{catalog.filter(item=>String(item.category||'Other')===group).length}</span></button>)}</div>
  <div className="lp-inventory-grid" role="group" aria-label="Available cargo">
   {filtered.map(item=><button type="button" key={item.id} className={'lp-inventory-item'+(String(value)===String(item.id)?' selected':'')+(item.stock<=0?' no-stock':'')} aria-pressed={String(value)===String(item.id)} disabled={requireStock&&item.stock<=0} onClick={()=>onChange(String(item.id))}><span className="lp-inventory-art"><i className={'fa-solid '+iconFor(item.category,item.name)} aria-hidden="true"/></span><span className="lp-inventory-name"><strong>{item.name}</strong><small>{nameCategory(item.category)}</small></span><span className="lp-inventory-quantity"><strong>{amount(item.stock)}</strong><small>{item.stock>0?'In stock':'Not stocked'}</small></span>{String(value)===String(item.id)&&<i className="fa-solid fa-circle-check lp-inventory-selected" aria-label="Selected"/>}</button>)}
   {!filtered.length&&<div className="lp-inventory-empty"><i className="fa-solid fa-box-open" aria-hidden="true"/><strong>No cargo matches this view</strong><span>{hasStock?'Try another category or search.':'This origin has no recorded cargo yet. Choose another source or browse the item catalog.'}</span></div>}
  </div>
  {chosen&&<div className="lp-inventory-confirm"><i className={'fa-solid '+iconFor(chosen.category,chosen.name)} aria-hidden="true"/><span><small>SELECTED CARGO</small><strong>{chosen.name}</strong></span><span className="lp-inventory-confirm-count">{amount(chosen.stock)} units available</span><button type="button" onClick={()=>onChange('')} aria-label="Clear selected cargo"><i className="fa-solid fa-xmark"/></button></div>}
  {!chosen&&<div className="lp-inventory-hint"><i className="fa-solid fa-hand-pointer" aria-hidden="true"/> Select a cargo card to add it to the manifest.</div>}
 </section>;
}
