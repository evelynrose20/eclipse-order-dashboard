import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const get=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const site=get('src/PublicSite.jsx'),theme=get('src/imperial-theme.css'),portal=get('src/LocalWorkspace.jsx');
test('hero has custom industrial fortress instead of the old circle illustration',()=>{
 assert.match(site,/className="imperial-architecture"/);
 for(const className of ['imperial-structure-left','imperial-structure-center','imperial-structure-right','imperial-citadel-crest','imperial-cityline'])assert.ok(site.includes(className),className);
 assert.doesNotMatch(site,/public-hero-ring|public-hero-disk|public-hero-stars/);
 assert.match(site,/WITHOUT <em>EMPIRE\.<\/em>/);
});
test('crest is a custom geometric symbol and the page uses an industrial lettering system',()=>{
 assert.match(site,/<svg viewBox="0 0 64 72"/);
 assert.match(theme,/Barlow\+Condensed/);
 assert.match(theme,/IBM\+Plex\+Sans/);
 assert.match(theme,/--imperial-heading/);
 assert.match(theme,/\.order-public \.public-hero h1/);
 assert.match(theme,/\.imperial-architecture/);
 assert.match(theme,/\.imperial-structure-center/);
});
test('full public site and authenticated portal share the imperial visual language',()=>{
 for(const section of ['public-introduction','public-history','imperial-chronicles','public-hierarchy','public-play','public-bad-end','public-conduct','public-visit','public-recruit-fit','public-membership','public-faq','public-footer'])assert.ok(theme.includes('public-'+section.replace(/^public-/,''))||theme.includes('.order-public .'+section),section);
 for(const element of ['.order-nav','.topbar','.page-intro h1','.panel','.eo-character','.btn.primary','.eo-auth-card','.lore-hero','.lore-editor'])assert.ok(theme.includes(element),element);
 assert.match(portal,/import '\.\/imperial-theme\.css'/);
});
test('existing navigation, recruitment workflow and public lore remain present',()=>{
 assert.match(site,/id="membership"/);
 assert.match(site,/<PublicChronicles\/>/);
 assert.match(site,/recruitmentLabel/);
 assert.match(site,/href="\?portal"/);
 assert.match(site,/\['chronicles','Chronicles'\]/);
});
