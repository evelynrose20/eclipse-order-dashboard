// Industry DSL: data-only predicates and safe actions, no scripting/eval.
const integer=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
const qty=(n,max=1000)=>typeof n==='number'&&Number.isFinite(n)&&n>0&&n<=max&&Math.round(n*1000)===n*1000;
const fields=new Set(['level','workforce','heat_available','power_available','capacity_pct','population','stability','security','status']);
const numericFields=new Set(['level','workforce','heat_available','power_available','capacity_pct','population','stability','security']);
export const validItemId=x=>typeof x==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(x)&&x.length<=48;
function validMaterials(values,allowEmpty=false){
 return Array.isArray(values)&&(allowEmpty||values.length>0)&&values.length<=20&&values.every(row=>row&&validItemId(row.item_id)&&qty(row.qty))&&new Set(values.map(x=>x.item_id)).size===values.length;
}
export function validateIndustryConfiguration(c){
 if(!c||typeof c!=='object'||Array.isArray(c))return 'configuration_required';
 if(!validMaterials(c.inputs,true)||!validMaterials(c.outputs)||!validMaterials(c.byproducts||[],true))return 'invalid_recipe_items';
 if(!integer(c.labor,1,10000)||!integer(c.heat,0,100000)||!integer(c.power,0,100000)||!integer(c.capacity,1,1000)||!integer(c.upgrade_level,1,20))return 'invalid_capacity_or_requirements';
 const produced=new Set([...c.outputs,...(c.byproducts||[])].map(x=>x.item_id));
 if(c.inputs.some(x=>produced.has(x.item_id)))return 'self_consuming_recipe';
 if(c.outputs.some(x=>(c.byproducts||[]).some(y=>y.item_id===x.item_id)))return 'duplicate_output_item';
 return null;
}
export function validateIndustryRules(rules){
 if(!Array.isArray(rules)||rules.length>20)return 'invalid_rules';
 for(const rule of rules){
  if(!rule||!Array.isArray(rule.when)||rule.when.length<1||rule.when.length>8||!rule.action||!['allow','block','multiplier'].includes(rule.action.type))return 'invalid_rule_shape';
  if(rule.action.type==='multiplier'&&(!Number.isFinite(rule.action.value)||rule.action.value<0||rule.action.value>3))return 'invalid_multiplier';
  if(rule.action.type!=='multiplier'&&rule.action.value!==undefined)return 'unexpected_action_value';
  if(rule.message!==undefined&&(typeof rule.message!=='string'||rule.message.length>180))return 'invalid_rule_message';
  for(const pred of rule.when){
   if(!pred||!fields.has(pred.field)||!['eq','neq','gte','lte'].includes(pred.op))return 'invalid_predicate';
   if(numericFields.has(pred.field)?typeof pred.value!=='number'||!Number.isFinite(pred.value):typeof pred.value!=='string'||pred.value.length>40)return 'invalid_predicate_value';
   if(pred.field==='status'&&!['captured','liberated','ruined','rebuilding','operational','damaged','paused'].includes(pred.value))return 'invalid_status_predicate';
   if(pred.field==='status'&&!['eq','neq'].includes(pred.op))return 'invalid_status_operator';
  }
 }
 return null;
}
export function industryDependenciesHaveCycle(configurations){
 const graph=new Map();
 for(const c of configurations){
  for(const input of c.inputs||[]){
   if(!graph.has(input.item_id))graph.set(input.item_id,new Set());
   for(const output of [...(c.outputs||[]),...(c.byproducts||[])]){
    graph.get(input.item_id).add(output.item_id);
    if(!graph.has(output.item_id))graph.set(output.item_id,new Set());
   }
  }
 }
 const visited=new Set(),visiting=new Set();
 function visit(id){
  if(visiting.has(id))return true;
  if(visited.has(id))return false;
  visiting.add(id);
  for(const next of graph.get(id)||[])if(visit(next))return true;
  visiting.delete(id);visited.add(id);return false;
 }
 return [...graph.keys()].some(visit);
}
function predicateMatches(p,ctx){
 const value=ctx[p.field];
 return p.op==='eq'?value===p.value:p.op==='neq'?value!==p.value:p.op==='gte'?Number(value)>=p.value:Number(value)<=p.value;
}
export function evaluateIndustryRules(rules,ctx){
 let multiplier=1;const messages=[];
 for(const r of rules||[]){
  if(!r.when.every(p=>predicateMatches(p,ctx)))continue;
  if(r.message)messages.push(r.message);
  if(r.action.type==='block')return {allowed:false,multiplier:0,messages};
  if(r.action.type==='multiplier')multiplier=Math.min(3,multiplier*r.action.value);
 }
 return {allowed:true,multiplier,messages};
}
export function industryProductionPreview(facility,config,rules,stock={},context={}){
 const fails=[];
 if(facility.status!=='operational')fails.push('facility_not_operational');
 if(Number(facility.level)<config.upgrade_level)fails.push('requires_upgrade_level');
 const availableWorkforce=Math.max(0,Number(facility.workforce)||0);
 const availableHeat=Math.max(0,Number(facility.heat_available)||0);
 const availablePower=Math.max(0,Number(facility.power_available)||0);
 const cap=Math.max(0,Math.floor(config.capacity*Math.min(100,Number(facility.capacity_pct)||0)/100));
 const limits=[cap];
 if(config.labor)limits.push(Math.floor(availableWorkforce/config.labor));
 if(config.heat)limits.push(Math.floor(availableHeat/config.heat));
 if(config.power)limits.push(Math.floor(availablePower/config.power));
 for(const input of config.inputs)limits.push(Math.floor(Number(stock[input.item_id]||0)/input.qty));
 const ctx={...context,level:Number(facility.level),workforce:availableWorkforce,heat_available:availableHeat,power_available:availablePower,capacity_pct:Number(facility.capacity_pct),status:facility.status};
 const decision=evaluateIndustryRules(rules,ctx);
 if(!decision.allowed)fails.push('rule_blocked');
 const operations=fails.length||decision.multiplier===0?0:Math.min(1000,Math.floor(Math.max(0,Math.min(...limits))));
 const scale=(arr,multiplier=1)=>Object.fromEntries(arr.map(x=>[x.item_id,Math.round(x.qty*operations*multiplier*1000)/1000]));
 return {operations,throughput_multiplier:decision.multiplier,blocked:fails,rule_messages:decision.messages,inputs:scale(config.inputs),outputs:scale(config.outputs,decision.multiplier),byproducts:scale(config.byproducts||[],decision.multiplier),requirements:{labor:config.labor,heat:config.heat,power:config.power,capacity:config.capacity,upgrade_level:config.upgrade_level},limits:{capacity:cap,workforce:availableWorkforce,heat:availableHeat,power:availablePower}};
}
