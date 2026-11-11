import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const shared=read('src/LogisticsPlannerUI.jsx');
const corridors=read('src/LogisticsCorridorsPanel.jsx');
const journeys=read('src/LogisticsItineraries.jsx');
const stores=read('src/LogisticsWarehouses.jsx');
const styles=read('src/freight-logistics.css');

test('each numbered logistics section is an independent screen, not a stacked form',()=>{
 assert.match(shared,/React\.Children\.toArray\(children\)/);
 assert.match(shared,/child\.type===Step/);
 assert.match(shared,/total\?stages\[index\]:children/);
 assert.match(shared,/hasWizard&&<nav/);
 assert.match(shared,/Step \{index\+1\} of \{total\}/);
 assert.match(shared,/setActive\(index\+1\)/);
 assert.match(shared,/setActive\(Math\.max\(0,index-1\)\)/);
 assert.match(shared,/>Next <i/);
 assert.match(shared,/> Back<\/button>/);
 assert.match(shared,/atEnd\?footer:/);
 assert.match(styles,/\.lp-wizard-track/);
 assert.match(styles,/\.lp-wizard-content/);
});

test('corridor and warehouse planners block Next until the current stage is ready',()=>{
 assert.match(corridors,/stepValidations=\{\[true,!!draft\.origin_settlement_id/);
 assert.match(stores,/stepValidations=\{\[!!firstLevel,!!draft\.settlement_id/);
 assert.match(stores,/number\(draft\.quantity\)<=number\(selectedStock\?\.quantity\)/);
 assert.match(stores,/mode==='rail'\?!!draft\.train_journey_id:!!draft\.vehicle_lot_id/);
 assert.match(shared,/disabled=\{!allowed\}/);
 assert.match(shared,/disabled=\{i>furthest\}/);
});

test('dynamic freight legs each become a navigable numbered screen',()=>{
 assert.match(journeys,/stepValidations=\{\[!!draft\.name\.trim\(\)/);
 assert.match(journeys,/\.\.\.draft\.legs\.map\(leg=>/);
 assert.match(journeys,/draft\.legs\.map\(\(leg,i\)=>/);
 assert.match(journeys,/number=\{i\+3\}/);
 assert.match(journeys,/Survey connected routes/);
 assert.match(journeys,/Add another transfer stop/);
});
