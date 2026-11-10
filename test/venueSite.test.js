import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=read('App.jsx'),publicSite=read('src/PublicSite.jsx'),venue=read('src/VenueSite.jsx'),menu=read('src/VenueMenu.jsx'),status=read('src/VenueStatus.jsx'),styles=read('src/venue-site.css'),deployment=read('.github/workflows/deploy.yml');

test('venue is a public page that leaves Discord login and dashboard routing intact',()=>{
 assert.match(app,/path==='\/venue'/);
 assert.match(app,/return <VenueSite\/>/);
 assert.match(app,/if\(memberRoute\)return <LocalAccounts\/>/);
 assert.match(publicSite,/href="\/venue"/);
 assert.match(publicSite,/<VenueStatus compact\/>/);
});

test('weekly venue nights advertise the correct schedule and separate ERP rules',()=>{
 assert.match(status,/day:5,name:'Thrall Night'/);
 assert.match(status,/day:0,name:'Business Night'/);
 assert.match(status,/6 PM–2 AM/);
 assert.match(status,/ERP permitted and expected/);
 assert.match(status,/Strictly no ERP/);
 assert.match(status,/ERP is not permitted during this event/);
 assert.match(venue,/Participation in ERP is always optional|VENUE_EVENTS/);
});

test('venue opening status handles cross-midnight hours and Eastern Time',()=>{
 assert.match(status,/America\/New_York/);
 assert.match(status,/minute>=1080/);
 assert.match(status,/minute<120/);
 assert.match(status,/setInterval\(refresh,60000\)/);
 assert.match(status,/WE ARE OPEN/);
 assert.match(status,/CURRENTLY CLOSED/);
});

test('the venue includes the Carrd menu, seasonal travel lore, and accessible navigation',()=>{
 for(const name of ['Blood Moon Velvet','The Black Halo','Crimson Reverie','Eclipse Nocturne','Midnight Eclipse','Vampiro','Obsidian Tonic'])assert.ok(menu.includes(name),name);
 assert.match(menu,/in-character gil only/);
 assert.match(venue,/New Cassia, Ilsabard/);
 assert.match(venue,/cold in winter/);
 assert.match(venue,/warm in summer/);
 assert.match(venue,/Characters are not IC in the Goblet/);
 assert.match(venue,/aria-label="Venue navigation"/);
 assert.match(styles,/@media\(max-width:590px\)/);
});

test('full menu has its own direct Pages route, separate from venue landing page',()=>{
 assert.match(app,/path==='\/venue\/menu'/);
 assert.match(app,/return <VenueMenu\/>/);
 assert.match(deployment,/dist\/venue\/menu\/index.html/);
 assert.match(venue,/href="\/venue\/menu\/"/);
 assert.doesNotMatch(venue,/SIGNATURES\.map|FOOD_MENU\.map|DESSERT_MENU\.map/);
 assert.match(menu,/SIGNATURES\.map/);
 assert.match(menu,/FOOD_MENU\.map/);
 assert.match(menu,/DESSERT_MENU\.map/);
});

test('dessert options and IC prices match the menu screenshots',()=>{
 for(const [name,price] of [['Crimson Moon Cheesecake','40,000'],['Gilded Night Cheesecake','15,000'],['Velvet Dusk Mousse','15,000'],['Scarlet Veil Parfait','15,000']]){
  assert.ok(menu.includes("name:'"+name+"'")||menu.includes('"name": "'+name+'"'),name);
  assert.ok(menu.includes('"price": "'+price+'"')||menu.includes("price:'"+price+"'"),price);
 }
});

test('menu photo slots accept predictable jpg filenames and preserve illustrated fallbacks',()=>{
 assert.match(menu,/venue-images/);
 assert.match(menu,/onError=\{event=>\{event.currentTarget.hidden=true\}\}/);
 assert.match(styles,/\.venue-card-photo\[hidden\]/);
 assert.match(menu,/<MenuPhoto name=\{drink.name\}\/>/);
 assert.match(menu,/<MenuPhoto name=\{dish.name\}\/>/);
});
