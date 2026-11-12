// Story-stage boundaries are percentages of the character's saved IC term.
export const DEVELOPMENT_STAGES=[
 {name:'Conception',from:0,detail:'Initial development recorded'},
 {name:'Early formation',from:0.12,detail:'Early structures beginning to form'},
 {name:'Organ development',from:0.24,detail:'Developing internal structures and body shape'},
 {name:'Growth',from:0.40,detail:'Distinct head, body and limb proportions'},
 {name:'Advanced development',from:0.62,detail:'Increasing size and distinct features'},
 {name:'Birth ready',from:0.84,detail:'Final gestation stage'}
];
export function gestationStage(days,total){
 const fraction=Math.max(0,Math.min(1,Number(days||0)/Math.max(1,Number(total||90))));
 const index=DEVELOPMENT_STAGES.reduce((acc,s,i)=>fraction>=s.from?i:acc,0);
 return {index,stage:DEVELOPMENT_STAGES[index],fraction};
}
