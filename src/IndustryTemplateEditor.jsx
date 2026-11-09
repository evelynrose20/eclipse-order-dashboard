import React,{useState} from 'react';
const defaults=()=>({name:'',slug:'',category:'mine',configuration:{inputs:[],outputs:[],byproducts:[],labor:1,heat:0,power:0,capacity:1,upgrade_level:1},rules:[]});
export function equipmentAssemblyDraft(equipment,items=[]){
 const id=typeof equipment==='string'?equipment:equipment?.item_id;
 const e=typeof equipment==='string'?{}:equipment;
 const kind=e.equipment_kind||'transport';
 const floors={transport:[10,6,2],locomotive:[18,10,4],railcar:[12,7,2],armored_vehicle:[14,10,3],airship:[25,14,5],capital_airship:[120,100,80],field_equipment:[5,5,1],siege_equipment:[18,12,3],other:[8,5,1]};
 const [base,labor,power]=floors[kind]||floors.other;
 const material=Math.max(5,base+Math.ceil(Number(e.cargo_capacity||0)/50)+Math.ceil(Number(e.transport_capacity||0)/10));
 const iron=Math.max(1,Math.ceil(material*.8));
 return {...defaults(),category:'manufacturing',
  name:(e.name||items.find(x=>x.id===id)?.name||'Magitek')+' Assembly Line',
  slug:('works-'+id).slice(0,70),
  configuration:{...defaults().configuration,
   inputs:[{item_id:'iron-ingot',qty:iron},{item_id:'ceruleum-fuel',qty:material-iron}],
   outputs:[{item_id:id,qty:1}],labor,heat:kind==='capital_airship'?40:5,
   power,capacity:1,upgrade_level:1}};
}
const fields=[['status','Facility state'],['level','Facility level'],['workforce','Simulated workers available'],['heat_available','Fuel-backed heat available'],['power_available','Fuel-backed power available'],['capacity_pct','Operating capacity %'],['population','Settlement residents'],['stability','Civic stability'],['security','Security'],['temperature_f','Outdoor temperature (°F)'],['weather','Weather conditions']];
const heading=s=>s.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
export default function IndustryTemplateEditor({template=null,suggestedOutputItem=null,items=[],request,onSaved,onCancel}){
 const [draft,setDraft]=useState(()=>template?{name:template.name,slug:template.slug,category:template.category,configuration:structuredClone(template.configuration),rules:structuredClone(template.rules||[])}:suggestedOutputItem?equipmentAssemblyDraft(suggestedOutputItem,items):defaults());
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[test,setTest]=useState(null);
 const [scenario,setScenario]=useState({status:'operational',level:1,capacity_pct:100,workforce:30,heat_available:30,power_available:30,weather:'clear',temperature_f:32});
 const [scenarioStock,setScenarioStock]=useState({});
 const [saveMode,setSaveMode]=useState('edit');
 const setConfig=(field,value)=>setDraft(d=>({...d,configuration:{...d.configuration,[field]:value}}));
 const changeRow=(kind,i,key,val)=>setConfig(kind,draft.configuration[kind].map((row,j)=>j===i?{...row,[key]:key==='qty'?Number(val):val}:row));
 const addRow=kind=>{const item=items.find(i=>!draft.configuration[kind].some(x=>x.item_id===i.id));if(item)setConfig(kind,[...draft.configuration[kind],{item_id:item.id,qty:1}]);};
 const changeRule=(i,patch)=>setDraft(d=>({...d,rules:d.rules.map((r,j)=>i===j?{...r,...patch}:r)}));
 const changeCondition=(i,k,patch)=>changeRule(i,{when:draft.rules[i].when.map((p,j)=>j===k?{...p,...patch}:p)});
 async function submit(path,body,onDone,closeAfter=false){
  setBusy(true);setError('');
  try{const response=await request(path,{method:'POST',body});onDone(response);if(closeAfter&&onSaved)await onSaved();}
  catch(e){setError(e.message||'Unable to save industry template')}
  finally{setBusy(false)}
 }
 const payload=()=>({...draft,configuration:{...draft.configuration},rules:draft.rules});
 return <section className="wa-industry-editor">
  <header><div><span className="wa-kicker">VERSIONED INDUSTRY TEMPLATE</span><h3>{template?(saveMode==='edit'?'Edit version '+template.current_version:'Publish version '+(Number(template.current_version)+1)):'New facility template'}</h3><p>{template?(saveMode==='edit'?'Save changes to this version, including existing sites using it. Historical cycle reports remain unchanged.':'Create a separate version without changing existing sites.'):'Define a reusable facility type without modifying server code.'}</p></div><button type="button" onClick={onCancel}>Close</button></header>
  {error&&<p role="alert" className="wa-error">{error}</p>}
  <div className="wa-industry-editor-grid">
   <label>Name<input value={draft.name} maxLength="120" disabled={Boolean(template)} required onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
   <label>Template ID<input value={draft.slug} maxLength="70" disabled={Boolean(template)} placeholder="voidsent-mine" onChange={e=>setDraft({...draft,slug:e.target.value.toLowerCase().replace(/\s+/g,'-')})}/></label>
   <label>Industry<select value={draft.category} disabled={Boolean(template)} onChange={e=>setDraft({...draft,category:e.target.value})}>{['mine','extraction','refinery','manufacturing','utilities','agriculture','other'].map(c=><option key={c} value={c}>{heading(c)}</option>)}</select></label>
  </div>
  <div className="wa-industry-rule-layout">
   <section><h4>Production requirements</h4><div className="wa-industry-editor-grid">{[['labor','Workforce needed / operation'],['heat','Heat needed / operation'],['power','Power needed / operation'],['capacity','Maximum operations / cycle'],['upgrade_level','Minimum facility level']].map(([field,label])=><label key={field}>{label}<input type="number" step="1" min={field==='upgrade_level'||field==='capacity'||field==='labor'?1:0} max={field==='capacity'?100:field==='upgrade_level'?20:100000} value={draft.configuration[field]} onChange={e=>setConfig(field,Number(e.target.value))}/></label>)}</div>
    {['inputs','outputs','byproducts'].map(kind=><div className="wa-industry-material-group" key={kind}><div className="wa-industry-section-heading"><h4>{heading(kind)}</h4><button type="button" onClick={()=>addRow(kind)} disabled={draft.configuration[kind].length>=20||!items.length}>+ Add item</button></div>{draft.configuration[kind].map((row,i)=><div className="wa-industry-material-line" key={i}><select aria-label={kind+' material'} value={row.item_id} onChange={e=>changeRow(kind,i,'item_id',e.target.value)}>{items.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select><input aria-label={kind+' quantity'} type="number" step=".001" min=".001" value={row.qty} onChange={e=>changeRow(kind,i,'qty',e.target.value)}/><button type="button" aria-label={'Remove '+kind} onClick={()=>setConfig(kind,draft.configuration[kind].filter((_,j)=>j!==i))}>×</button></div>)}{!draft.configuration[kind].length&&<p className="wa-npc-subtle">{kind==='inputs'?'No input needed; suitable for extracting raw deposits.':kind==='outputs'?'At least one output is required.':'No additional byproducts.'}</p>}</div>)}
   </section>
   <section><div className="wa-industry-section-heading"><h4>Condition & action rules</h4><button type="button" onClick={()=>setDraft(d=>({...d,rules:[...d.rules,{when:[{field:'level',op:'gte',value:1}],action:{type:'allow'},message:''}]}))}>+ Add rule</button></div><p className="wa-npc-subtle">Magitek vehicles and railcars are finished equipment items. Assembly requires at least two distinct input materials, five workers per operation, power, and whole-unit outputs. Create equipment designs in Magitek & war stores first.</p><p className="wa-npc-subtle">Rules are declarative, versioned, and never execute scripts. Matching conditions can block production or alter throughput.</p>
    {draft.rules.map((rule,i)=><div className="wa-industry-rule-card" key={i}>
      <div className="wa-industry-section-heading"><strong>Rule {i+1}</strong><button type="button" onClick={()=>setDraft(d=>({...d,rules:d.rules.filter((_,j)=>i!==j)}))}>Remove</button></div>
      {rule.when.map((p,j)=><div className="wa-industry-condition" key={j}>
       <select aria-label="Condition field" value={p.field} onChange={e=>changeCondition(i,j,{field:e.target.value,op:['status','weather'].includes(e.target.value)?'eq':p.op,value:e.target.value==='status'?'operational':e.target.value==='weather'?'clear':1})}>{fields.map(([k,label])=><option key={k} value={k}>{label}</option>)}</select>
       <select aria-label="Comparison" value={p.op} onChange={e=>changeCondition(i,j,{op:e.target.value})}>{(['status','weather'].includes(p.field)?['eq','neq']:['eq','neq','gte','lte']).map(v=><option key={v} value={v}>{v}</option>)}</select>
       {['status','weather'].includes(p.field)?<select value={p.value} onChange={e=>changeCondition(i,j,{value:e.target.value})}>{(p.field==='weather'?['clear','cloudy','overcast','rain','snow','blizzard']:['captured','liberated','ruined','rebuilding','operational','damaged','paused']).map(v=><option key={v} value={v}>{heading(v)}</option>)}</select>:<input aria-label="Comparison value" type="number" value={p.value} onChange={e=>changeCondition(i,j,{value:Number(e.target.value)})}/>}
       <button type="button" disabled={rule.when.length===1} aria-label="Remove condition" onClick={()=>changeRule(i,{when:rule.when.filter((_,k)=>j!==k)})}>×</button>
      </div>)}
      <button type="button" className="wa-industry-link" disabled={rule.when.length>=8} onClick={()=>changeRule(i,{when:[...rule.when,{field:'level',op:'gte',value:1}]})}>+ And condition</button>
      <div className="wa-industry-condition"><label>Then<select value={rule.action.type} onChange={e=>changeRule(i,{action:e.target.value==='multiplier'?{type:'multiplier',value:1}:{type:e.target.value}})}>{['allow','block','multiplier'].map(v=><option key={v} value={v}>{heading(v)}</option>)}</select></label>{rule.action.type==='multiplier'&&<label>Output multiplier<input type="number" min="0" max="3" step=".1" value={rule.action.value} onChange={e=>changeRule(i,{action:{type:'multiplier',value:Number(e.target.value)}})}/></label>}</div>
      <label>Reason (optional)<input value={rule.message||''} maxLength="180" onChange={e=>changeRule(i,{message:e.target.value})}/></label>
     </div>)}
    {!draft.rules.length&&<p className="wa-industry-empty">No custom rules. The normal workforce, input, heat, power, level and capacity requirements still apply.</p>}
   </section>
  </div>
  <details className="wa-civic-form"><summary>Dry-run scenario · simulate available workers, utilities and goods</summary><div className="wa-industry-form">
   {[['level','Facility level'],['capacity_pct','Capacity %'],['workforce','Workers'],['heat_available','Heat available'],['power_available','Power available']].map(([key,label])=><label key={key}>{label}<input type="number" min="0" step="1" value={scenario[key]} onChange={e=>setScenario({...scenario,[key]:Number(e.target.value)})}/></label>)}
   <label>Weather<select value={scenario.weather} onChange={e=>setScenario({...scenario,weather:e.target.value})}>{['clear','cloudy','overcast','rain','snow','blizzard'].map(x=><option value={x} key={x}>{heading(x)}</option>)}</select></label><label>Temperature (°F)<input type="number" value={scenario.temperature_f} onChange={e=>setScenario({...scenario,temperature_f:Number(e.target.value)})}/></label><label>Facility state<select value={scenario.status} onChange={e=>setScenario({...scenario,status:e.target.value})}>{['operational','captured','liberated','rebuilding','damaged','paused'].map(status=><option value={status} key={status}>{heading(status)}</option>)}</select></label>
   {draft.configuration.inputs.map(input=><label key={input.item_id}>{items.find(x=>x.id===input.item_id)?.name||input.item_id} available<input type="number" min="0" step=".001" value={scenarioStock[input.item_id]??100} onChange={e=>setScenarioStock({...scenarioStock,[input.item_id]:Number(e.target.value)})}/></label>)}
   <p className="wide wa-npc-subtle">A dry run uses hypothetical numbers only; it cannot assign workers, conjure fuel, change a site, move stock, or commit production. Live production takes workers from simulated local employment and heat/power from actual facility ceruleum fuel.</p>
  </div></details>
  {test&&<div className="wa-industry-dryresult"><strong>Rule dry run</strong><span>{test.operations} operations · {test.blocked.length?test.blocked.join(', '):'No blocking conditions'}</span><small>{JSON.stringify(test.outputs)}</small></div>}
  <footer>{template&&<label>Save as <select aria-label="Template save mode" value={saveMode} onChange={e=>setSaveMode(e.target.value)}><option value="edit">Update current version</option><option value="new">Create new version</option></select></label>}<button type="button" onClick={()=>submit('/world-admin/industry/rules/dry-run',{...payload(),facility:scenario,stock:Object.fromEntries(draft.configuration.inputs.map(x=>[x.item_id,scenarioStock[x.item_id]??100]))},r=>setTest(r.preview))} disabled={busy}>Dry-run rules</button><button type="button" className="wa-accent" disabled={busy} onClick={()=>submit(template?'/world-admin/industry/templates/'+template.id+(saveMode==='edit'?'/edit':'/versions'):'/world-admin/industry/templates',payload(),()=>{},true)}>{busy?'Saving…':template?(saveMode==='edit'?'Save version '+template.current_version:'Publish new version'):'Create template'}</button></footer>
 </section>;
}
