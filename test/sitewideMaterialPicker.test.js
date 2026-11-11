import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const shared=read('src/MaterialPicker.jsx');
const pages=[
 'Workshop.jsx','Fronts.jsx','ConstructionProjects.jsx','IndustrySitesPanel.jsx',
 'Commerce.jsx','SettlementUpgradesPanel.jsx','MagitekEquipmentPanel.jsx',
 'IndustryTemplateEditor.jsx','CivicNeedsPanel.jsx','CivicTemplateManager.jsx',
 'MilitaryInstallationsPanel.jsx','LogisticsWarehouses.jsx','FreightLogistics.jsx',
 'LogisticsAirDocks.jsx','LogisticsCorridorsPanel.jsx'
];
test('material inventory picker opens a searchable accessible card catalog outside clipped forms',()=>{
 assert.match(shared,/createPortal\(/);
 assert.match(shared,/aria-modal="true"/);
 assert.match(shared,/role="dialog"/);
 assert.match(shared,/role="group" aria-label="Select an inventory item"/);
 assert.match(shared,/type="search"/);
 assert.match(shared,/eo-material-categories/);
 assert.match(shared,/eo-material-card/);
 assert.match(shared,/const categories=/);
 assert.match(shared,/quantity:item.quantity\?\?item.stock\?\?null/);
 assert.match(shared,/item\.id===String\(value\)/);
 assert.match(shared,/document\.addEventListener\('keydown',escape\)/);
});
test('site-wide material inventory replaces legacy item selectors without rewriting unrelated controls',()=>{
 for(const file of pages){
  const source=read('src/'+file);
  assert.match(source,/import MaterialPicker from '\.\/MaterialPicker\.jsx'/,file);
  assert.match(source,/<MaterialPicker\b/,file);
  const open=(source.match(/<MaterialPicker\b/g)||[]).length;
  const close=(source.match(/<\/MaterialPicker>/g)||[]).length+(source.match(/<MaterialPicker\b[^\n]*?\/>/g)||[]).length;
  assert.equal(open,close,file+' should keep picker tags balanced');
 }
});
test('Workshop, Fronts and construction keep material-only options callbacks',()=>{
 for(const name of ['Workshop.jsx','Fronts.jsx','ConstructionProjects.jsx']){
  const source=read('src/'+name);
  assert.doesNotMatch(source,/<SearchPicker\b/,name);
  assert.match(source,/options=\{/);
 }
});
test('both logistics cargo manifest cards and smaller item fields are inventory-based',()=>{
 assert.match(read('src/LogisticsItineraries.jsx'),/LogisticsCargoPicker/);
 assert.match(read('src/LogisticsWarehouses.jsx'),/LogisticsCargoPicker/);
 assert.match(read('src/FreightLogistics.jsx'),/LogisticsCargoPicker/);
 assert.match(read('src/LogisticsCorridorsPanel.jsx'),/<MaterialPicker catalog=\{items\}/);
});
