/** Deterministic RP-world hazards. Applied once per completed production cycle. */
const clamp=(x,a,b)=>Math.max(a,Math.min(b,Math.floor(Number(x)||0)));
export function weatherHazard({weather='clear',temperature_f=32,weather_protection_level=0,industry_category='other',equipment_condition=100,workforce=0,facility_id=0,cycle_key=''}) {
 const outdoor=['agriculture','mine','extraction'].includes(industry_category);
 const storm=weather==='blizzard'?4:weather==='snow'?2:weather==='rain'?1:0;
 const cold=temperature_f<=-20?3:temperature_f<=0?1:0;
 const exposure=Math.max(0,(outdoor?storm+cold:Math.ceil((storm+cold)/2))-clamp(weather_protection_level,0,3)*2);
 // Replay-safe: independent of concurrent requests, server restarts and random generator state.
 const seed=String(facility_id)+':'+String(cycle_key);
 let hash=2166136261;for(let i=0;i<seed.length;i++){hash=Math.imul(hash^seed.charCodeAt(i),16777619)>>>0}
 const roll=hash%100;
 const threshold=Math.min(85,exposure*12);
 const triggered=exposure>0&&roll<threshold;
 const damage=triggered?Math.min(20,Math.max(1,exposure*2)):0;
 const cropLoss=outdoor&&industry_category==='agriculture'&&triggered?Math.min(60,exposure*10):0;
 const injuries=triggered&&workforce>0?Math.min(clamp(workforce,0,1e7),Math.max(1,Math.floor(workforce*exposure/200))):0;
 return {triggered,exposure,damage,crop_loss_pct:cropLoss,injured_workers:injuries,
  next_condition:Math.max(0,clamp(equipment_condition,0,100)-damage)};
}
/** Healthcare stays bounded by medical infrastructure, doctors and real medicine. */
export function workerHealthCycle({population=0,employed=0,sick_workers=0,injured_workers=0,temperature_f=32,heating_coverage=100,medical_access=50,clinic_count=0,trained_workers=0,medicine_units=0,weather='clear'}) {
 const workers=Math.max(0,Math.floor(employed));
 let injured=clamp(injured_workers,0,workers);
 let sick=clamp(sick_workers,0,workers-injured);
 const risk=(temperature_f<=0?1:0)+(temperature_f<=-20?2:0)+(heating_coverage<60?2:0)+(weather==='blizzard'?1:0);
 const newSick=Math.min(workers-injured-sick,Math.floor(workers*risk/250));
 sick+=newSick;
 const doctors=Math.min(Math.floor(Math.max(0,trained_workers)/15),Math.max(0,clinic_count)*Math.max(1,Math.floor(medical_access/20)));
 const careSlots=Math.min(Math.floor(Math.max(0,medicine_units)),doctors*3);
 const recoveredInjured=Math.min(injured,Math.floor(careSlots*.5));
 const recoveredSick=Math.min(sick,careSlots-recoveredInjured);
 injured-=recoveredInjured;sick-=recoveredSick;
 return {sick_workers:sick,injured_workers:injured,new_sick:newSick,recovered_sick:recoveredSick,recovered_injured:recoveredInjured,
  doctors,care_slots:careSlots,medicine_required:recoveredSick+recoveredInjured,available_workers:Math.max(0,workers-sick-injured)};
}
