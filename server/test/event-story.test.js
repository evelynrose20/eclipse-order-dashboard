import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeEventStory,readEventStory,eventTypeLabel,defaultEventStory} from '../src/event-story.js';

test('FC MSQ story chapters and ratings validate and round trip',()=>{
 const story={type:'fc_msq',difficulty:6,impact:3,chapters:[
  {title:'The Empty Nets',description:'Investigate the docks.',difficulty:4},
  {title:'Beneath the Tide',description:'Enter the flooded warren.',difficulty:6},
  {title:'What Took Them',description:'Face what waits there.',difficulty:8}
 ]};
 assert.deepEqual(sanitizeEventStory(story),story);
 assert.deepEqual(readEventStory(JSON.stringify(story)),story);
 assert.equal(eventTypeLabel(story.type),'FC MSQ');
 assert.equal(readEventStory(null).type,'standard');
 assert.equal(defaultEventStory().chapters.length,0);
});
test('event metadata rejects invalid ratings, chapters, and payloads',()=>{
 const good={type:'standard',difficulty:3,impact:2,chapters:[]};
 for(const payload of [
  {...good,difficulty:0},{...good,difficulty:11},
  {...good,impact:0},{...good,impact:6},
  {...good,type:'private'},
  {...good,chapters:Array.from({length:13},()=>({title:'Chapter',description:'',difficulty:3}))},
  {...good,chapters:[{title:'',description:'',difficulty:4}]},
  {...good,chapters:[{title:'Valid',description:'',difficulty:20}]},
  {...good,chapters:[{title:'Valid',description:'x'.repeat(501),difficulty:3}]}
 ])assert.equal(sanitizeEventStory(payload),null);
});
