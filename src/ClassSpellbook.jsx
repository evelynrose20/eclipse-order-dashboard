import React,{useState} from 'react';
import './homebrew-classes.css';
const spellPoints=(style,level)=>style==='full'?2+2*level:style==='half'?(level<2?0:1+Math.floor(level/2)):0;
export default function ClassSpellbook({character,klass,request,onRefresh,userId,readOnly=false}){
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 if(!klass||character.progression_version!==1)return null;
 const level=Number(character.level)||1;
 const features=(klass.features||[]).filter(f=>f.level<=level);
 const available=(klass.spells||[]).filter(s=>s.level<=level);
 const later=(klass.spells||[]).filter(s=>s.level>level);
 const cap=spellPoints(klass.casting,level);
 const remaining=Number.isInteger(character.spell_points)?character.spell_points:cap;
 const own=character.player_user_id===userId&&!character.collar_bound&&!readOnly;
 async function perform(action,body){
  setBusy(true);setNotice('');
  try{await request('/characters/'+character.id+'/'+action,{method:'POST',body});await onRefresh();setNotice(action==='rest'?'Spell points fully restored.':'Spell cast recorded. Resolve its effect in the encounter.') }
  catch(e){setNotice(e.message)}finally{setBusy(false)}
 }
 return <section className="panel class-spellbook"><div className="panel-heading"><div><h2>{klass.name} · Class progression</h2><p>Level {level} of 20. Abilities and spells unlock through event XP as you level up.</p></div></div>
  {cap>0&&<div className="spell-resource"><strong>{remaining} / {cap} spell points</strong><span>Spend spell points when you cast. A long rest replenishes them.</span>{own&&<button className="mini-btn" type="button" disabled={busy||remaining>=cap} onClick={()=>{if(window.confirm('Record a long rest and restore spell points?'))perform('rest',{confirm:true})}}>Long rest · Restore</button>}</div>}
  <h3>Unlocked class abilities</h3><div className="class-feature-grid">{features.length?features.map((feature,i)=><article key={i}><strong>{feature.name}</strong><small>Level {feature.level}</small>{feature.description&&<p>{feature.description}</p>}</article>):<p className="muted">No feature definitions yet.</p>}</div>
  {klass.casting!=='none'&&<><h3>Available spells</h3><div className="class-spell-grid">{available.length?available.map(spell=><article key={spell.id}><div><strong>{spell.name}</strong><small>Level {spell.level} · {spell.cost} spell point{spell.cost===1?'':'s'}</small></div><p>{spell.description}</p>{own&&<button type="button" className="mini-btn" disabled={busy||remaining<spell.cost} onClick={()=>perform('cast',{spell_id:spell.id})}>Cast spell</button>}</article>):<p className="muted">No spells unlocked yet.</p>}</div>
   <h3>Future spell unlocks</h3><div className="spell-future-list">{later.length?later.map(spell=><div key={spell.id}><strong>Level {spell.level}</strong><span>{spell.name}</span><small>{spell.cost} SP</small></div>):<p className="muted">All currently defined spells are unlocked.</p>}</div>
  </>}
  {notice&&<div className="alert" role="status">{notice}</div>}
 </section>;
}
