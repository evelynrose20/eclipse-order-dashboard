import test from 'node:test';
import assert from 'node:assert/strict';
import {weatherHazard,workerHealthCycle} from '../src/world-worker-hazards.js';
test('storm hazards are deterministic and mitigated by constructed protection',()=>{
 const input={facility_id:7,cycle_key:'2026-11-08',industry_category:'agriculture',weather:'blizzard',temperature_f:-25,equipment_condition:100,workforce:200};
 assert.deepEqual(weatherHazard(input),weatherHazard(input));
 const bare=weatherHazard(input);
 const shielded=weatherHazard({...input,weather_protection_level:3});
 assert.ok(shielded.exposure<=bare.exposure);
 assert.equal(shielded.damage,0);
 assert.equal(shielded.injured_workers,0);
});
test('worker care cannot heal without doctors or medicine',()=>{
 const base={employed:200,injured_workers:10,sick_workers:8,temperature_f:50,heating_coverage:100,medical_access:100,clinic_count:1,trained_workers:100,medicine_units:0};
 const none=workerHealthCycle(base);
 assert.equal(none.recovered_injured,0);
 assert.equal(none.recovered_sick,0);
 const treated=workerHealthCycle({...base,medicine_units:100});
 assert.ok(treated.recovered_injured>0);
 assert.ok(treated.medicine_required<=100);
 assert.equal(treated.available_workers,200-treated.sick_workers-treated.injured_workers);
 assert.equal(workerHealthCycle({...base,clinic_count:0,medicine_units:100}).medicine_required,0);
});
test('extreme cold creates bounded sickness and never exceeds employed residents',()=>{
 const x=workerHealthCycle({employed:12,sick_workers:10,injured_workers:2,temperature_f:-40,heating_coverage:0,medical_access:0,clinic_count:0,trained_workers:0,medicine_units:0,weather:'blizzard'});
 assert.ok(x.sick_workers+x.injured_workers<=12);
 assert.equal(x.available_workers,0);
});
