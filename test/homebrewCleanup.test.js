import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Homebrew Classes navigation and editor have been fully removed',()=>{
 const workspace=read('src/LocalWorkspace.jsx');
 const nav=read('src/OrderNavigation.jsx');
 assert.doesNotMatch(workspace,/HomebrewClasses|Homebrew classes|tab==='classes'/);
 assert.doesNotMatch(nav,/classes:'administration'|classes:'Classes and spellbooks'/);
 assert.equal(existsSync(new URL('../src/HomebrewClasses.jsx',import.meta.url)),false);
 assert.equal(existsSync(new URL('../src/homebrew-classes.css',import.meta.url)),false);
});
test('the retained character spellbook uses its own style rather than the retired editor',()=>{
 const spellbook=read('src/ClassSpellbook.jsx');
 const dossier=read('src/CharacterDossier.jsx');
 assert.match(spellbook,/class-spellbook\.css/);
 assert.match(dossier,/<ClassSpellbook/);
 assert.match(read('src/class-spellbook.css'),/\.spell-resource|\.class-spellbook/);
});
test('character creation and ongoing class progression are not removed',()=>{
 const workspace=read('src/LocalWorkspace.jsx');
 const server=read('server/src/class-catalog.js');
 assert.match(workspace,/reloadClasses\(\)/);
 assert.match(workspace,/classCatalog=\{classCatalog\}/);
 assert.match(server,/export async function loadClassCatalog/);
 assert.match(server,/order_homebrew_classes/);
 assert.doesNotMatch(server,/INSERT INTO order_homebrew_classes/);
});
