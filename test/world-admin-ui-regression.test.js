import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToString} from 'react-dom/server';
import {createServer} from 'vite';

test('Industry workspace renders a safe loading state before first API response',async()=>{
 const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'silent'});
 try{
  const {default:IndustrySitesPanel}=await vite.ssrLoadModule('/src/IndustrySitesPanel.jsx');
  const html=renderToString(React.createElement(IndustrySitesPanel,{request:async()=>({})}));
  assert.match(html,/Loading industrial sites/);
  assert.match(html,/INDUSTRY &amp; PROJECTS/);
 }finally{await vite.close()}
});
test('world admin contains stacked navigation and map expands to its own workspace',async()=>{
 const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'silent'});
 try{
  const {default:WorldAdministration}=await vite.ssrLoadModule('/src/WorldAdministration.jsx');
  const html=renderToString(React.createElement(WorldAdministration,{request:async()=>({})}));
  assert.match(html,/World Administration/);
  const {readFile}=await import('node:fs/promises');
  const jsx=await readFile(new URL('../src/WorldAdministration.jsx',import.meta.url),'utf8');
  const css=await readFile(new URL('../src/world-administration.css',import.meta.url),'utf8');
  assert.match(jsx,/wa-geography-picker/);
  assert.match(jsx,/wa-map-workspace/);
  assert.match(jsx,/role="group" aria-label="Select region"/);
  assert.match(jsx,/role="group" aria-label="Select zone"/);
  assert.match(css,/\.wa-map-main-panel \.wtm-stage\{height:clamp\(560px,72vh,1020px\)/);
 }finally{await vite.close()}
});

test('map fills its available zone width and grows height without distorting original art',async()=>{
 const {readFile}=await import('node:fs/promises');
 const css=await readFile(new URL('../src/world-administration.css',import.meta.url),'utf8');
 const dashboard=await readFile(new URL('../src/dashboard.css',import.meta.url),'utf8');
 const nav=await readFile(new URL('../src/order-navigation.css',import.meta.url),'utf8');
 assert.match(css,/\.wa-map-main-panel \.wtm-stage\s*\{/);
 assert.match(css,/width:100%/);
 assert.doesNotMatch(css,/width:min\(100%,1150px,115dvh\)/);
 assert.match(css,/height:auto/);
 assert.match(css,/aspect-ratio:900 \/ 560/);
 const block=css.split('/* Cartography is authored at 900 × 560.')[1]?.split('/* Compact the World Administration chrome')[0];
 assert.ok(block,'proportional zone map overrides must exist');
 assert.match(block,/width:100%/);
 assert.match(block,/max-width:none/);
 assert.match(block,/height:auto/);
 assert.match(dashboard,/Data-dense desktop layout/);
 assert.match(nav,/Compact desktop navigation/);
});

test('industry attaches to existing region map locations rather than offering a duplicate marker editor',async()=>{
 const {readFile}=await import('node:fs/promises');
 const jsx=await readFile(new URL('../src/IndustrySitesPanel.jsx',import.meta.url),'utf8');
 assert.match(jsx,/Attach production to a map location/);
 assert.match(jsx,/Existing map location/);
 assert.match(jsx,/categoryGroups\.map/);
 assert.match(jsx,/scopedSettlements/);
 assert.doesNotMatch(jsx,/Create mapped site/);
 assert.doesNotMatch(jsx,/setNewSite/);
 assert.doesNotMatch(jsx,/\/world-admin\/industry\/sites'/);
});
