// Character standing is separate from Discord website permissions and bound ranks.
export const UNBOUND_RANKS=Object.freeze([
 {id:'domina',label:'Domina'},
 {id:'oyabun',label:'Oyabun'},
 {id:'kusushi',label:'Kusushi'},
 {id:'operative',label:'Operative'},
 {id:'kumi_in',label:'Kumi-in / Initiate'}
]);
export const DEFAULT_UNBOUND_RANK='kumi_in';
export function validUnboundRank(code){return UNBOUND_RANKS.some(rank=>rank.id===code)}
export function unboundRankLabel(code){
 return UNBOUND_RANKS.find(rank=>rank.id===code)?.label||UNBOUND_RANKS.at(-1).label;
}
export function displayUnboundRank(code){return 'Unbound: '+unboundRankLabel(code)}
