import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {senateSeatPositions} from '../src/senateSeatGeometry.js';

test('fifteen elected Senate seats form three concentric semicircles',()=>{
 const seats=senateSeatPositions();
 assert.equal(seats.length,15);
 assert.ok(seats.every(p=>p.left>=0&&p.left<=100&&p.top>=0&&p.top<=100));
 for(const [start,count] of [[0,6],[6,5],[11,4]]){
  const row=seats.slice(start,start+count);
  assert.ok(row.every((p,i)=>i===0||p.left>row[i-1].left),'seats proceed left-to-right');
  assert.ok(row[0].top>row[Math.floor(count/2)].top,'each arc rises in the center');
 }
 // Seat centers must not collide even at the smallest supported chamber stage.
 for(let i=0;i<seats.length;i++)for(let j=i+1;j<seats.length;j++){
  const dx=(seats[i].left-seats[j].left)*2.5,dy=(seats[i].top-seats[j].top)*2.25;
  assert.ok(Math.hypot(dx,dy)>18,'seat '+i+' and '+j+' should not overlap');
 }
});
test('seats are always circular clickable controls, not theme-stretched rectangles',()=>{
 const css=readFileSync(new URL('../src/senate-chamber.css',import.meta.url),'utf8');
 const component=readFileSync(new URL('../src/SenateChamber.jsx',import.meta.url),'utf8');
 assert.match(css,/button\.pol-seat/);
 assert.match(css,/inline-size:16px!important/);
 assert.match(css,/block-size:16px!important/);
 assert.match(css,/border-radius:50%!important/);
 assert.match(component,/aria-pressed=\{active===seat.seat_number\}/);
 assert.match(component,/senateSeatPositions\(\)/);
 assert.doesNotMatch(component,/Math\.abs\(column-2\)/);
});
test('majority marker and three Heads are outside the seating geometry',()=>{
 const component=readFileSync(new URL('../src/SenateChamber.jsx',import.meta.url),'utf8');
 assert.match(component,/<div className="pol-seat-layout">/);
 assert.match(component,/<div className="pol-majority">/);
 assert.match(component,/<div className="pol-heads">/);
 assert.match(component,/<Dots seats=\{seats\}/);
});
