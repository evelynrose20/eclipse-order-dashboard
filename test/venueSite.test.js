import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=read('App.jsx'),publicSite=read('src/PublicSite.jsx'),venue=read('src/VenueSite.jsx'),status=read('src/VenueStatus.jsx'),styles=read('src/venue-site.css');

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
 for(const name of ['Blood Moon Velvet','The Black Halo','Crimson Reverie','Eclipse Nocturne','Midnight Eclipse','Vampiro','Obsidian Tonic'])assert.ok(venue.includes(name),name);
 assert.match(venue,/All menu prices are in-character gil only/);
 assert.match(venue,/New Cassia, Ilsabard/);
 assert.match(venue,/cold in winter/);
 assert.match(venue,/warm in summer/);
 assert.match(venue,/Characters are not IC in the Goblet/);
 assert.match(venue,/aria-label="Venue navigation"/);
 assert.match(styles,/@media\(max-width:590px\)/);
});
