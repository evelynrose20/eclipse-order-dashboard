import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../src/portal-controls.css',import.meta.url),'utf8');
const workspace=readFileSync(new URL('../src/LocalWorkspace.jsx',import.meta.url),'utf8');
const navigation=readFileSync(new URL('../src/OrderNavigation.jsx',import.meta.url),'utf8');

test('member portal loads shared control styles',()=>{
 assert.match(workspace,/import '\.\/portal-controls\.css'/);
 assert.match(css,/\.app-shell\.eo-local/);
 assert.doesNotMatch(css,/\.order-public/);
});

test('shared UI gives common inputs consistent focus, dropdown and disabled states',()=>{
 assert.match(css,/select\[multiple\]/);
 assert.match(css,/appearance:none/);
 assert.match(css,/focus-visible/);
 assert.match(css,/input\[type="checkbox"\]/);
 assert.match(css,/button:not\(\[class\]\)/);
 assert.match(css,/prefers-reduced-motion/);
});

test('governance navigation no longer advertises a demo',()=>{
 assert.doesNotMatch(navigation,/Council and approval demo/);
 assert.match(navigation,/governing chamber and charter/);
});

test('class catalog uses the searchable picker instead of long browser dropdown',()=>{
 const classes=readFileSync(new URL('../src/HomebrewClasses.jsx',import.meta.url),'utf8');
 assert.match(classes,/SearchPicker value=\{id\} onChange=\{selectClass\}/);
 assert.match(classes,/category:"FFXIV jobs"/);
});
