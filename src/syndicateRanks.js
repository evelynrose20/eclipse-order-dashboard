// Legacy compatibility labels; modern in-character authority lives in order_rank_catalog.
// These titles are independent of technical account permissions and fictional binding ranks.
export const SYNDICATE_RANKS=[
 {id:'domina',label:'Imperatrix',description:'Sovereign of Imperium Noctis'},
 {id:'oyabun',label:'Praefectus',description:'Imperial officer (legacy code)'},
 {id:'kusushi',label:'Artifex',description:'Technical specialist (legacy code)'},
 {id:'operative',label:'Miles',description:'Imperial operative (legacy code)'},
 {id:'kumi_in',label:'Tiro',description:'New recruit (legacy code)'}
];
export const syndicateRankLabel=id=>SYNDICATE_RANKS.find(r=>r.id===id)?.label||'Tiro';
