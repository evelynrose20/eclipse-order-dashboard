// Structural integrity and territorial reconstruction are independent.
// A completed fortification can still be unavailable while its settlement is rebuilding.
export function installationReadiness(installation){
 const territory=String(installation?.strategic_state||'');
 const structure=String(installation?.state||'');
 const integrity=Math.max(0,Math.min(100,Number(installation?.condition_pct)||0));
 const blocked=['destroyed','abandoned','contested','occupied','rebuilding'];
 const effectiveState=blocked.includes(territory)?(territory==='rebuilding'?'rebuilding':territory):structure;
 const available=!blocked.includes(territory)&&['operational','damaged'].includes(structure)&&integrity>=25;
 return {effective_state:effectiveState,operational_ready:available,
  readiness_pct:available?integrity:0,
  territorial_state:territory,structural_integrity_pct:integrity};
}
