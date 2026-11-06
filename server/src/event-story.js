// Shared event-story validation. Every chapter is a separate scene in an event,
// and FC MSQ identifies postings that advance the Order's main storyline.
export const EVENT_TYPES=['standard','fc_msq','side_story'];
export const DIFFICULTY_MAX=10;
export const IMPACT_MAX=5;
export const MAX_CHAPTERS=12;
export function defaultEventStory(){return {type:'standard',difficulty:3,impact:2,chapters:[]};}
export function sanitizeEventStory(input){
 if(!input||typeof input!=='object'||Array.isArray(input))return null;
 if(!EVENT_TYPES.includes(input.type))return null;
 const difficulty=Number(input.difficulty),impact=Number(input.impact);
 if(!Number.isInteger(difficulty)||difficulty<1||difficulty>DIFFICULTY_MAX||!Number.isInteger(impact)||impact<1||impact>IMPACT_MAX)return null;
 if(!Array.isArray(input.chapters)||input.chapters.length>MAX_CHAPTERS)return null;
 const chapters=[];
 for(const entry of input.chapters){
  if(!entry||typeof entry!=='object'||Array.isArray(entry))return null;
  const title=typeof entry.title==='string'?entry.title.trim():'';
  const description=typeof entry.description==='string'?entry.description.trim():'';
  const difficulty=Number(entry.difficulty);
  if(!title||title.length>100||description.length>500||!Number.isInteger(difficulty)||difficulty<1||difficulty>DIFFICULTY_MAX)return null;
  chapters.push({title,description,difficulty});
 }
 return {type:input.type,difficulty,impact,chapters};
}
export function readEventStory(value){
 let parsed=value;
 if(typeof parsed==='string'){try{parsed=JSON.parse(parsed)}catch{return defaultEventStory()}}
 return sanitizeEventStory(parsed)||defaultEventStory();
}
export function eventTypeLabel(value){return value==='fc_msq'?'FC MSQ':value==='side_story'?'Side Story':'Order Event';}
