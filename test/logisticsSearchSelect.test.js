import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const files=['src/FreightLogistics.jsx','src/LogisticsCorridorsPanel.jsx','src/LogisticsItineraries.jsx','src/LogisticsWarehouses.jsx','src/LogisticsAirDocks.jsx','src/LogisticsInsulationPanel.jsx'];
const adapter=read('src/LogisticsSelect.jsx');
const shared=read('src/SearchPicker.jsx');

test('all logistics dropdown menus reuse the existing searchable SearchPicker',()=>{
 let total=0;
 for(const filename of files){
  const src=read(filename);
  assert.match(src,/import LogisticsSelect from '\.\/LogisticsSelect\.jsx'/,filename);
  assert.doesNotMatch(src,/<select\b/i,filename+' should not have native dropdowns');
  const opened=[...src.matchAll(/<LogisticsSelect\b/g)].length;
  const closed=[...src.matchAll(/<\/LogisticsSelect>/g)].length;
  assert.equal(opened,closed,filename);
  total+=opened;
 }
 assert.equal(total,18);
 assert.match(adapter,/import SearchPicker from '\.\/SearchPicker\.jsx'/);
 assert.match(adapter,/onChange=\{id=>onChange\?\.\(\{target:\{value:id\}\}\)\}/);
 assert.match(adapter,/optionLabel\(option\.props\.children\)/);
});

test('searchable choices keep existing dashboard search and accessibility behavior',()=>{
 assert.match(shared,/role="listbox"/);
 assert.match(shared,/type="search"/);
 assert.match(shared,/ArrowDown/);
 assert.match(shared,/ArrowUp/);
 assert.match(shared,/Escape/);
 assert.match(adapter,/ariaLabel=\{ariaLabel\|\|prompt\}/);
 assert.match(adapter,/disabled=\{disabled\}/);
});
