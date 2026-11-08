import {resolveSession} from './auth.js';

const forbidden=(status,error)=>({status,body:{error}});

// Both IC Household assignments and IC thrall character ranks are distinct from website staff roles.
export async function mayEnterThralls(pool,actor){
 if(['domina','high_command','handler'].includes(actor.account_role))return true;
 const [ranks]=await pool.execute(
  "SELECT 1 FROM account_order_ranks WHERE account_id=? AND track='household' LIMIT 1",
  [actor.id]
 );
 if(ranks.length)return true;
 const [characters]=await pool.execute(
  "SELECT 1 FROM characters c LEFT JOIN character_order_ranks r ON r.character_id=c.id LEFT JOIN order_rank_catalog cat ON cat.code=r.rank_code WHERE c.player_account_id=? AND (c.collar_bound=1 OR cat.track='servitude') LIMIT 1",
  [actor.id]
 );
 return characters.length>0;
}

export async function thrallsRoute(pool,req,path){
 if(!pool)return forbidden(503,'database_unavailable');
 const actor=await resolveSession(pool,req);
 if(!actor)return forbidden(401,'not_authenticated');
 if(path!=='/thralls/chamber'||req.method!=='GET')return forbidden(404,'not_found');
 if(!await mayEnterThralls(pool,actor))return forbidden(403,'access_denied');
 return {status:200,body:{
  title:'Aetheric Extraction Chamber',
  subtitle:'The Eclipse Order · Lower vaults',
  description:'A permanent Garlean-inspired magitek installation for consensual adult roleplay. The central extraction throne is connected to separate lacteal and secondary biological collection reservoirs, aetheric regulators and an adjacent alchemical processing station.',
  areas:[
   {name:'Central apparatus',detail:'A fixed reclining magitek chair set into a raised iron-and-stone dais, with independent upper and lower collection assemblies.'},
   {name:'Collection wall',detail:'Two distinct sealed reservoir banks with etched level markings, reinforced glass and crimson-violet aether conduits.'},
   {name:'Operator console',detail:'Independent system status, cycle timing, reservoir capacity, aetheric readings, system diagnostics and emergency release.'},
   {name:'Alchemical annex',detail:'Kusushi research bench for cataloguing fictional material properties and preparing approved recipes.'},
   {name:'Observation gallery',detail:'A screened gallery and ledger desk for authorized Order RP scenes.'}
  ],
  safeguards:'All participation and scene boundaries require explicit OOC agreement. IC authority never overrides OOC consent; any participant can stop a scene immediately.'
 }};
}
