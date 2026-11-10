import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateRoster,venueRoute} from '../server/src/venue.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const seed=JSON.parse(read('public/venue-roster.json'));
const normalized={staff:seed.staff.map(e=>({...e,vacancy:!!e.vacancy})),thralls:seed.thralls.map(e=>({...e,vacancy:!!e.vacancy}))};

test('existing venue members and vacancies can be saved from the dashboard without code editing',()=>{
 assert.equal(validateRoster(normalized),true);
 assert.equal(validateRoster({...normalized,staff:[...normalized.staff,normalized.staff[0]]}),false);
 assert.equal(validateRoster({...normalized,staff:[{...normalized.staff[0],description:'x'.repeat(901)}]}),false);
 assert.equal(validateRoster({...normalized,staff:[{...normalized.staff[0],image:'javascript:alert(1)'}]}),false);
 assert.equal(validateRoster({...normalized,staff:[{...normalized.staff[0],image:'/venue/images/00000000-0000-4000-8000-000000000000.jpg'}]}),true);
});
test('public venue roster is fetched from database without exposing private account data',async()=>{
 const pool={execute:async()=>[[]]};
 const result=await venueRoute(pool,{method:'GET'},'/venue/public');
 assert.equal(result.status,200);
 assert.equal(result.body.staff.length,4);
 assert.equal(result.body.thralls.length,4);
 assert.equal(result.body.staff[0].name,'Elira Sakurai');
 assert.equal(Object.hasOwn(result.body,'version'),false);
});
test('public venue roster reads updated content from stored settings',async()=>{
 const edited={staff:[{...normalized.staff[0],name:'Updated Public Name'}],thralls:[],version:3};
 const pool={execute:async()=>[[{content:JSON.stringify(edited)}]]};
 const result=await venueRoute(pool,{method:'GET'},'/venue/public');
 assert.equal(result.body.staff[0].name,'Updated Public Name');
 assert.equal(result.body.thralls.length,0);
});
test('venue edit routes are authenticated while public roster is not',async()=>{
 const result=await venueRoute({execute:async()=>{throw Error('should not query for authless user')}},{headers:{},method:'PUT'},'/venue/manage');
 assert.equal(result.status,401);
});
test('dashboard Venue Management is command-only and public roster uses the API',()=>{
 const workspace=read('src/LocalWorkspace.jsx');
 const nav=read('src/OrderNavigation.jsx');
 const editor=read('src/VenueManagement.jsx');
 const publicRoster=read('src/VenueRoster.jsx');
 const server=read('server/src/server.js');
 assert.match(workspace,/VenueManagement request=\{request\}/);
 assert.match(workspace,/canManage\(profile.role\).*venue-management/);
 assert.match(nav,/venue-management/);
 assert.match(editor,/\/venue\/manage/);
 assert.match(editor,/\/venue\/upload/);
 assert.match(publicRoster,/\/venue\/public/);
 assert.match(server,/venueRoute\(pool,req,pathname\)/);
 assert.match(server,/result.rawBody/);
});
