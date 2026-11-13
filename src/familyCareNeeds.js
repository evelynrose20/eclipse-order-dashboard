// In-character household care meters, calculated from persisted care actions.
// No punishment, child health simulation, cash ledger or adult RP mechanics.
export const CARE_NEEDS=[
 {id:'nourishment',label:'Fed',icon:'fa-utensils',actions:['nursing','bottle','meal'],recovery:85,decayHours:18},
 {id:'comfort',label:'Comfort',icon:'fa-heart',actions:['comfort','play'],recovery:85,decayHours:24},
 {id:'hygiene',label:'Hygiene',icon:'fa-soap',actions:['hygiene'],recovery:90,decayHours:30},
 {id:'rest',label:'Rest',icon:'fa-moon',actions:['sleep'],recovery:90,decayHours:24}
];
const SCHOOL_NEEDS=[
 {id:'fun',label:'Fun',icon:'fa-shapes',actions:['play','creative','athletics'],recovery:90,decayHours:36},
 {id:'social',label:'Social',icon:'fa-user-group',actions:['friends','comfort','play'],recovery:90,decayHours:36},
 {id:'learning',label:'Education',icon:'fa-book-open',actions:['school','homework','reading','mathematics','tutoring'],recovery:90,decayHours:48}
];
const TEEN_NEED={id:'independence',label:'Independence',icon:'fa-compass',actions:['independence','creative'],recovery:90,decayHours:48};
export const CARE_ACTIVITY_NEED=Object.fromEntries(CARE_NEEDS.flatMap(n=>n.actions.map(a=>[a,n.id])));
export function careNeeds(dependent,events=[],now=new Date()){
 const nowMs=new Date(now).getTime();
 const createdMs=new Date(dependent?.created_at||now).getTime();
 const stage=dependent?.stage;
 const base=CARE_NEEDS.map(need=>need.id==='comfort'&&['child','teen'].includes(stage)
  ? {...need,label:'Well-being',actions:['comfort','friends']} : need);
 const configured=stage==='child'?[...base,...SCHOOL_NEEDS]:stage==='teen'?[...base,...SCHOOL_NEEDS,TEEN_NEED]
  :stage==='toddler'?[...base,{id:'fun',label:'Play',icon:'fa-shapes',actions:['play'],recovery:90,decayHours:36}]
  :base;
 return configured.map(need=>{
  const last=events.find(e=>need.actions.includes(e.action));
  const timestamp=new Date(last?.created_at||createdMs).getTime();
  const elapsed=Math.max(0,(nowMs-(Number.isFinite(timestamp)?timestamp:nowMs))/3600000);
  const initial=last?need.recovery:80;
  // Not intended as real medical advice or a medical risk threshold.
  const value=Math.max(20,Math.round(initial-Math.min(60,elapsed/need.decayHours*60)));
  return {id:need.id,label:need.label,icon:need.icon,value,
   status:value>=65?'Settled':value>=40?'Needs attention':'Care overdue',
   lastAction:last?.action||null};
 });
}
export function carePriority(needs){
 return needs.reduce((a,b)=>b.value<a.value?b:a,needs[0]||null);
}
