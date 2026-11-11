import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

const picker=read('src/SearchPicker.jsx'),adapter=read('src/LogisticsSelect.jsx');
const cargo=read('src/LogisticsCargoPicker.jsx'),styles=read('src/logistics-cargo-picker.css');
const itinerary=read('src/LogisticsItineraries.jsx'),warehouses=read('src/LogisticsWarehouses.jsx'),freight=read('src/FreightLogistics.jsx');
const popupCss=read('src/SearchPicker.css');

test('search menus use portal positioning rather than clipping inside the scrolling wizard',()=>{
 assert.match(adapter,/<SearchPicker portal/);
 assert.match(picker,/import \{createPortal\} from 'react-dom'/);
 assert.match(picker,/createPortal\(popup,document.body\)/);
 assert.match(picker,/getBoundingClientRect/);
 assert.match(picker,/const flip=below<250&&above>below/);
 assert.match(picker,/popover.current\?\.contains\(e.target\)/);
 assert.match(picker,/window.addEventListener\('scroll',positionPopup,true\)/);
 assert.match(popupCss,/\.eo-search-popover-portaled/);
 assert.match(popupCss,/z-index:20000/);
});

test('cargo manifests use categorized stock-aware visual item cards',()=>{
 assert.match(cargo,/lp-inventory-grid/);
 assert.match(cargo,/lp-inventory-categories/);
 assert.match(cargo,/type="search"/);
 assert.match(cargo,/aria-pressed=\{String\(value\)===String\(item.id\)\}/);
 assert.match(cargo,/sourceFacilityId/);
 assert.match(cargo,/requireStock\?available/);
 assert.match(cargo,/item.stock<=0/);
 assert.match(styles,/\.lp-inventory-item\.selected/);
 assert.match(styles,/\.lp-inventory-quantity/);
});

test('connected freight, warehouse convoys and standalone dispatch reuse the cargo inventory',()=>{
 for(const [name,source] of [['connected freight',itinerary],['warehouse convoy',warehouses],['standalone freight',freight]]){
  assert.match(source,/import LogisticsCargoPicker from '\.\/LogisticsCargoPicker.jsx'/,name);
  assert.match(source,/<LogisticsCargoPicker /,name);
 }
 assert.match(itinerary,/stocks=\{data.stocks\|\|\[\]\}/);
 assert.match(warehouses,/sourceFacilityId=\{draft.source_facility_id\} requireStock/);
 assert.match(freight,/sourceFacilityId=\{manifest.source_facility_id\} requireStock/);
 assert.doesNotMatch(itinerary,/Industrial cargo<LogisticsSelect/);
 assert.doesNotMatch(warehouses,/Industrial material<LogisticsSelect value=\{draft.item_id\}/);
});
