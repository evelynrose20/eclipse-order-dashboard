import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const get=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=get('App.jsx'),site=get('src/PublicSite.jsx'),style=get('src/public-site.css');

test('public homepage is the default and existing member portal remains separate',()=>{
 assert.match(app,/return <PublicSite\/>/);
 assert.match(app,/new URLSearchParams\(window\.location\.search\)\.has\('portal'\)/);
 assert.match(app,/VITE_ECLIPSE_API_URL\?<LocalAccounts\/>:<Dashboard\/>/);
 assert.match(site,/href="\?portal"/);
 assert.doesNotMatch(site,/href="\/portal"/);
});
test('public website includes original Order identity, sections, and accessible interactions',()=>{
 for(const section of ['about','history','ranks','roleplay','conduct','membership','questions']){
  assert.match(site,new RegExp('id="'+section+'"'));
 }
 for(const rank of ['Domina','Oyabun','Kusushi','Operative','Kumi-in / Initiate']){
  assert.ok(site.includes(rank),rank);
 }
 assert.match(site,/aria-modal="true"/);
 assert.match(site,/aria-expanded=\{expandedFAQ===i\}/);
 assert.match(site,/role="tablist"/);
 assert.match(site,/onClick=\{closeMenu\}/);
 assert.match(site,/A Final Fantasy XIV roleplay community/);
});
test('homepage is publicly readable without private API, accounts, or fake external links',()=>{
 assert.doesNotMatch(site,/fetch\(|useLocal|localApi|sessionStorage|access_token|password/i);
 assert.doesNotMatch(site,/discord\.gg|Shirogane Ward|Plot 7|www\.rkcmateus\.com/);
 assert.doesNotMatch(site,/href="#"/);
 assert.match(style,/@media\(max-width:760px\)/);
 assert.match(style,/@media\(prefers-reduced-motion:reduce\)/);
});
