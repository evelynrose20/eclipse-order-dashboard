import React,{useState} from 'react';

// Level advancement belongs with the character dossier, not a separate shop.
export default function CharacterProgression({character,canCommand,request,onRefresh,readOnly=false}){
 const [ability,setAbility]=useState('str');
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const managed=character.progression_version===1;
 if(!managed)return null;
 async function perform(path,payload,success){
  setBusy(true);setNotice('');
  try{
   await request('/characters/'+character.id+'/'+path,{method:'POST',body:payload});
   await onRefresh();
   setNotice(success);
  }catch(error){setNotice(error.message)}
  finally{setBusy(false)}
 }
 const options=[['str','Strength'],['dex','Dexterity'],['con','Constitution'],['int','Intelligence'],['wis','Wisdom'],['cha','Charisma']];
 const spendable=Number(character.ability_points)||0;
 return <section className="panel" style={{marginTop:20}}>
  <div className="panel-heading"><div><h2>Character advancement</h2><p>Earn experience from completed events. Ability improvements unlock as you gain levels.</p></div></div>
  {spendable>0?<div className="inline-sheet-grid">
   <label className="field"><span>IMPROVE AN ABILITY · {spendable} POINT{spendable===1?'':'S'} AVAILABLE</span>
    <select value={ability} onChange={e=>setAbility(e.target.value)}>{options.map(([id,label])=><option key={id} value={id} disabled={Number(character[id])>=20}>{label} ({character[id]})</option>)}</select>
   </label><button type="button" className="btn secondary" disabled={readOnly||busy||Number(character[ability])>=20} onClick={()=>perform('ability',{ability},'Ability improved.')}>Spend ability point</button>
  </div>:<p className="muted">No ability points available. Your next improvements arrive as you level up.</p>}
  {notice&&<div className="alert" role="status">{notice}</div>}
 </section>;
}
