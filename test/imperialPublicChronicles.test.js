import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const homepage=read('src/PublicSite.jsx'),chronicles=read('src/PublicChronicles.jsx');
const publicCss=read('src/imperial-theme.css'),timelineCss=read('src/public-chronicles.css');
const portal=read('src/LocalWorkspace.jsx'),archive=read('src/LoreArchive.jsx');
test('complete published timeline is embedded in the homepage, not linked away as a prerequisite',()=>{
 assert.match(homepage,/<PublicChronicles\/>/);
 assert.match(homepage,/\['chronicles','Chronicles'\]/);
 assert.match(chronicles,/id="chronicles"/);
 assert.match(chronicles,/fetch\(API\+'\/lore\/public'/);
 assert.match(chronicles,/entries\.filter\(e=>e\.kind==='history'\)/);
 assert.match(chronicles,/FOUNDING_RECORDS/);
 assert.match(chronicles,/id:'new-cassia'/);
});
test('homepage keeps chronological section numbering around the inserted lore section',()=>{
 for(const [number,label] of [['01','THE ORDER'],['02','A HISTORY WRITTEN IN SHADOW'],['04','THE ORDER OF THE SERPENT'],['05','HOW WE ROLEPLAY'],['06','THE NATURE OF THE ORDER'],['07','BEYOND THE MASK'],['08','FIND THE ORDER'],['09',"WHO WE'RE LOOKING FOR"],['11','QUESTIONS BEFORE THE OATH']])
  assert.ok(homepage.includes('<SectionTag number="'+number+'">'+label+'</SectionTag>'),label);
 assert.match(chronicles,/public-section-tag"><span>03<\/span>/);
 assert.match(homepage,/<SectionTag number="10">\{recruitment/);
});
test('imperial identity spans public website, member portal and standalone archive',()=>{
 assert.match(homepage,/import '\.\/imperial-theme\.css'/);
 assert.match(portal,/import '\.\/imperial-theme\.css'/);
 assert.match(archive,/import '\.\/imperial-theme\.css'/);
 for(const token of ['--imperial-iron','--imperial-crimson','--imperial-silver'])assert.ok(publicCss.includes(token),token);
 for(const selector of ['.order-public .public-header','.order-public .public-hero','.eo-local.app-shell .order-nav','.eo-local.app-shell .panel','.lore-root .lore-hero'])assert.ok(publicCss.includes(selector),selector);
 assert.match(timelineCss,/@media\(max-width:900px\)/);
 assert.match(timelineCss,/\.imperial-chronicles-reading/);
});
test('New Cassia remains the RP home and the existing estate stays a distinct visit address',()=>{
 assert.match(homepage,/NEW CASSIA · ILSABARD/);
 assert.match(homepage,/\['WORLD','Dynamis'\]/);
 assert.match(homepage,/\['DATA CENTER','Seraph'\]/);
 assert.match(homepage,/\['PLOT','41'\]/);
});
