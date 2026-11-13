// Fictional aetheric traits for the Imperial Lineage Project.
// Each marker is an observation, not an automatically applied character mutation.
export const LINEAGE_TRAITS=[
 {id:'dream_resonance',name:'Dream resonance',kind:'source'},
 {id:'void_aether_trace',name:'Voidsent aether trace',kind:'source'},
 {id:'skin_tint',name:'Subtle skin pigment shift',kind:'carrier'},
 {id:'hair_shift',name:'Altered hair pigmentation',kind:'carrier'},
 {id:'eye_glimmer',name:'Faint eye luminescence',kind:'carrier'},
 {id:'aether_resonance',name:'Low-level umbral resonance',kind:'carrier'},
 {id:'violet_skin',name:'Violet skin',kind:'descendant'},
 {id:'umbral_aura',name:'Umbral aura',kind:'descendant'},
 {id:'black_scales',name:'Black scales',kind:'descendant'},
 {id:'pointed_tail',name:'Elongated pointed tail',kind:'descendant'},
 {id:'stable_void_essence',name:'Stable voidsent essence',kind:'descendant'},
 {id:'dream_echo',name:'Inherited dream sensitivity',kind:'descendant'}
];
export const DEFAULT_VOID_OFFSPRING_TRAITS=['violet_skin','umbral_aura','black_scales','pointed_tail','stable_void_essence'];
export const TRAIT_NAMES=Object.fromEntries(LINEAGE_TRAITS.map(t=>[t.id,t.name]));
export const LINEAGE_ROLES=['source','carrier','descendant'];
export const LINEAGE_STAGES=['none','subtle','developing','stable'];
export const OFFSPRING_STAGES=['not_recorded','anticipated','documented'];
export function validTraits(traits,role){
 return Array.isArray(traits)&&traits.length<=12&&new Set(traits).size===traits.length
  &&traits.every(id=>typeof id==='string'&&LINEAGE_TRAITS.some(t=>t.id===id&&t.kind===role));
}
