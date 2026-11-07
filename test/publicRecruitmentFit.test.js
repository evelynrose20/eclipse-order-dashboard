import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const publicSite=readFileSync(new URL('../src/PublicSite.jsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/public-site.css',import.meta.url),'utf8');

test('recruitment fit appears before membership with a working anchor',()=>{
 const fit=publicSite.indexOf('id="who-fits"');
 const membership=publicSite.indexOf('id="membership"');
 assert.ok(fit>0&&fit<membership);
 assert.match(publicSite,/href="#who-fits">Who Fits In/);
 assert.match(publicSite,/public-fit-welcome/);
 assert.match(publicSite,/public-fit-not-for/);
});

test('recruitment fit welcomes Garleans and criminals but rejects heroic main-character play',()=>{
 assert.match(publicSite,/Garleans/);
 assert.match(publicSite,/criminals, smugglers, spies, mercenaries/);
 assert.match(publicSite,/heroic Free Company/);
 assert.match(publicSite,/Warrior of Light/);
 assert.match(publicSite,/player/i);
});

test('recruitment fit is rendered as HTML and responsive CSS rather than a static image',()=>{
 assert.match(css,/\.public-fit-grid\{display:grid/);
 assert.match(css,/@media\(max-width:880px\)/);
 assert.match(css,/\.public-fit-lore/);
 assert.doesNotMatch(publicSite.slice(publicSite.indexOf('id="who-fits"'),publicSite.indexOf('id="membership"')),/<img|<picture|<canvas|<svg/);
});

test('section numbering remains sequential',()=>{
 for(const [number,label] of [['08',"WHO WE'RE LOOKING FOR"],['09','THE DOOR IS OPEN'],['10','QUESTIONS BEFORE THE OATH']]){
  assert.ok(number==='09'?publicSite.includes('<SectionTag number="09">{recruitment='):publicSite.includes('<SectionTag number="'+number+'">'+label+'</SectionTag>'));
 }
});
