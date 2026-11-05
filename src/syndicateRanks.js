// Eclipse Order's official in-character syndicate hierarchy.
// These titles are independent of technical account permissions and fictional binding ranks.
export const SYNDICATE_RANKS=[
 {id:'domina',label:'Domina',description:'Supreme Leader / Head of Syndicate'},
 {id:'oyabun',label:'Oyabun',description:'Senior Boss / Officer'},
 {id:'kusushi',label:'Kusushi',description:'Specialist / Alchemist / Enforcer'},
 {id:'operative',label:'Operative',description:'Standard Member / Agent'},
 {id:'kumi_in',label:'Kumi-in / Initiate',description:'New Recruit / Probationary'}
];
export const syndicateRankLabel=id=>SYNDICATE_RANKS.find(r=>r.id===id)?.label||'Kumi-in / Initiate';
