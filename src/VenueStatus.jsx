import React,{useEffect,useState} from 'react';

// Public venue hours are based on Eastern Time, including daylight-saving changes.
// Each event begins at 6 PM and ends at 2 AM the following calendar morning.
export const VENUE_TIME_ZONE='America/New_York';
export const VENUE_EVENTS=[
 {day:5,name:'Thrall Night',hours:'Friday · 6 PM–2 AM',type:'ERP permitted and expected',description:'An adults-only venue night where open ERP is permitted and expected. Participation in ERP is always optional; respect each player’s OOC boundaries.'},
 {day:0,name:'Business Night',hours:'Sunday · 6 PM–2 AM',type:'Strictly no ERP',description:'A night for business, negotiations, requests, and discussions with the Domina and other heads of the Order. ERP is not permitted during this event.'}
];
function easternClock(now){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:VENUE_TIME_ZONE,weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(now).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
 const days={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
 return {day:days[parts.weekday],minute:Number(parts.hour)%24*60+Number(parts.minute)};
}
export function getVenueStatus(now=new Date()){
 const {day,minute}=easternClock(now);
 const current=VENUE_EVENTS.find(event=>(day===event.day&&minute>=1080)||((day+6)%7===event.day&&minute<120));
 if(current)return {open:true,current,next:null,message:'WE ARE OPEN',detail:current.name+' · Open until 2 AM ET'};
 const next=VENUE_EVENTS.map(event=>({event,minutesUntil:((event.day-day+7)%7)*1440+1080-minute})).map(x=>({...x,minutesUntil:x.minutesUntil<=0?x.minutesUntil+10080:x.minutesUntil})).sort((a,b)=>a.minutesUntil-b.minutesUntil)[0].event;
 return {open:false,current:null,next,message:'CURRENTLY CLOSED',detail:'Next: '+next.name+' · '+(next.day===5?'Friday':'Sunday')+' at 6 PM ET'};
}
export default function VenueStatus({compact=false}){
 const [now,setNow]=useState(()=>new Date());
 useEffect(()=>{
  const refresh=()=>setNow(new Date());
  const timer=setInterval(refresh,60000);
  document.addEventListener('visibilitychange',refresh);
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',refresh)};
 },[]);
 const status=getVenueStatus(now);
 return <div className={'venue-live-status '+(status.open?'is-open':'is-closed')+(compact?' is-compact':'')} role="status" aria-live="polite">
  <span className="venue-live-dot" aria-hidden="true"/><span><strong>{status.message}</strong><small>{status.detail}</small></span>
 </div>;
}
