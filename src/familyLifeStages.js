// Shared deterministic life-stage rules for childcare. All educational outcomes are RP records.
export const LIFE_STAGES=[
 {id:'newborn',name:'Newborn',age:'0–1 month',school:false},
 {id:'infant',name:'Infant',age:'1–12 months',school:false},
 {id:'toddler',name:'Toddler',age:'1–3 years',school:false},
 {id:'child',name:'School age',age:'4–12 years',school:true},
 {id:'teen',name:'Teenager',age:'13–17 years',school:true}
];
export const SCHOOL_ACTIVITIES={
 school:{label:'Attend school',skill:'knowledge',stages:['child','teen']},
 homework:{label:'Complete homework',skill:'knowledge',stages:['child','teen']},
 reading:{label:'Practice reading',skill:'literacy',stages:['toddler','child','teen']},
 mathematics:{label:'Study mathematics',skill:'knowledge',stages:['child','teen']},
 athletics:{label:'Practice athletics',skill:'athletics',stages:['child','teen']},
 creative:{label:'Creative hobby',skill:'creativity',stages:['toddler','child','teen']},
 friends:{label:'Spend time with friends',skill:'social',stages:['child','teen']},
 independence:{label:'Practice independence',skill:'independence',stages:['toddler','child','teen']},
 tutoring:{label:'Household tutoring',skill:'knowledge',stages:['child','teen']}
};
export const DEVELOPMENT_MILESTONES=[
 {id:'first_words',label:'First words',stages:['infant','toddler']},
 {id:'first_steps',label:'First steps',stages:['infant','toddler']},
 {id:'self_feeding',label:'Eating independently',stages:['toddler','child']},
 {id:'reading',label:'Reading independently',stages:['child','teen']},
 {id:'school_started',label:'First school attendance',stages:['child','teen']},
 {id:'first_project',label:'Completed a personal project',stages:['child','teen']},
 {id:'independent_routine',label:'Independent daily routine',stages:['teen']}
];
export const SKILL_LABELS={knowledge:'Learning',literacy:'Literacy',athletics:'Athletics',creativity:'Creativity',social:'Social confidence',independence:'Independence'};
export function skillProgress(events=[]){
 const counts=Object.fromEntries(Object.keys(SKILL_LABELS).map(key=>[key,0]));
 for(const e of events){
  const skill=SCHOOL_ACTIVITIES[e.action]?.skill;
  if(skill)counts[skill]=Math.min(100,counts[skill]+10);
  if(e.action==='play')counts.social=Math.min(100,counts.social+3);
 }
 return counts;
}
export function apparentAge(birthDate,asOf=new Date()){
 if(!birthDate)return null;
 const date=new Date(String(birthDate).slice(0,10)+'T00:00:00Z');
 if(!Number.isFinite(date.getTime())||date.getTime()>asOf.getTime())return null;
 const year=asOf.getUTCFullYear()-date.getUTCFullYear();
 const before=(asOf.getUTCMonth()*32+asOf.getUTCDate())<(date.getUTCMonth()*32+date.getUTCDate());
 return Math.max(0,year-Number(before));
}
export function suggestedStage(age){
 if(age===null)return null;
 return age<1?'infant':age<4?'toddler':age<13?'child':age<18?'teen':null;
}
