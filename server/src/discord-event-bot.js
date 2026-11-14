// Free, self-hosted announcements for Discord Scheduled Events.
// For weekly recurring events each upcoming occurrence has independent RSVP data.
import {Client,GatewayIntentBits,Events,ActionRowBuilder,ButtonBuilder,ButtonStyle,EmbedBuilder,PermissionsBitField} from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const token=process.env.DISCORD_BOT_TOKEN;
const guildId=process.env.DISCORD_GUILD_ID;
const channelId=process.env.DISCORD_EVENT_ANNOUNCEMENT_CHANNEL_ID;
const validId=value=>typeof value==='string'&&/^\d{15,25}$/.test(value);
if(!token||!validId(guildId)||!validId(channelId)){
 console.error('Configure DISCORD_BOT_TOKEN, DISCORD_GUILD_ID and DISCORD_EVENT_ANNOUNCEMENT_CHANNEL_ID in server/.env');
 process.exit(1);
}
const DAY=86400000;
const directory=path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'.eclipse-order'),'EclipseOrder','EventBot');
fs.mkdirSync(directory,{recursive:true});
const statePath=path.join(directory,'announcements.json');
let state={messages:{},votes:{}};
try{
 const loaded=JSON.parse(fs.readFileSync(statePath,'utf8'));
 if(loaded&&typeof loaded==='object')state={messages:loaded.messages||{},votes:loaded.votes||{}};
}catch(error){if(error.code!=='ENOENT'){console.error('Cannot read stored announcements',error);process.exit(1)}}
function persist(){
 const temp=statePath+'.tmp';
 fs.writeFileSync(temp,JSON.stringify(state,null,2),'utf8');
 fs.renameSync(temp,statePath);
}
const client=new Client({intents:[GatewayIntentBits.Guilds]});
const operations=new Map();
function serialized(key,work){
 const prior=operations.get(key)||Promise.resolve();
 const next=prior.catch(()=>{}).then(work);
 operations.set(key,next);
 next.finally(()=>{if(operations.get(key)===next)operations.delete(key)}).catch(()=>{});
 return next;
}
const eventUrl=event=>'https://discord.com/events/'+event.guildId+'/'+event.id;
const occurrenceKey=(id,when)=>id+':'+Math.floor(when.getTime()/1000);
const parseKey=key=>{
 const match=/^(\d{15,25}):(\d{9,12})$/.exec(key);
 return match?{id:match[1],seconds:Number(match[2])}:null;
};
// Discord's documented recurrence rule stores UTC timestamps and numeric weekly frequency (2).
// Non-weekly recurring events are handled as the current event, not guessed dates.
function occurrences(event,now=Date.now()){
 const start=event.scheduledStartAt;
 if(!start)return [];
 const rule=event.recurrenceRule;
 if(!rule||rule.frequency!==2){
  if((event.scheduledEndAt||start).getTime()<now)return [];
  return [{key:occurrenceKey(event.id,start),start,end:event.scheduledEndAt}];
 }
 const anchor=new Date(rule.start||start);
 if(!Number.isFinite(anchor.getTime()))return [];
 const interval=Math.max(1,Number(rule.interval)||1);
 const step=7*DAY*interval;
 const duration=event.scheduledEndAt?Math.max(0,event.scheduledEndAt.getTime()-start.getTime()):null;
 const startIndex=Math.max(0,Math.floor((now-DAY-anchor.getTime())/step));
 const result=[];
 for(let i=startIndex;i<startIndex+30;i++){
  if(rule.count!=null&&i>=rule.count)break;
  const time=anchor.getTime()+i*step;
  if(rule.end&&time>new Date(rule.end).getTime())break;
  const endTime=duration===null?time:time+duration;
  if(endTime<now)continue;
  const instance=new Date(time);
  result.push({key:occurrenceKey(event.id,instance),start:instance,end:duration===null?null:new Date(endTime)});
  break; // Only the next occurrence of a repeating event is announced.
 }
 return result;
}
function votesFor(key){return state.votes[key]||{}}
function results(key){
 const rows={yes:[],no:[],maybe:[]};
 for(const [user,response] of Object.entries(votesFor(key))){
  if(Object.hasOwn(rows,response)&&validId(user))rows[response].push(user);
 }
 return rows;
}
function buttons(key){
 const r=results(key);
 const btn=(choice,label,emoji,style)=>new ButtonBuilder()
  .setCustomId('rsvp:'+key+':'+choice).setLabel(label+' ('+r[choice].length+')')
  .setEmoji(emoji).setStyle(style);
 return [new ActionRowBuilder().addComponents(
  btn('yes','Accepted','✅',ButtonStyle.Success),
  btn('no','Declined','❌',ButtonStyle.Danger),
  btn('maybe','Tentative','❔',ButtonStyle.Primary)
 )];
}
function names(users){
 if(!users.length)return 'Nobody yet';
 // Names render as non-pinging member mentions; field sizes stay under Discord limits.
 const shown=users.slice(0,18).map(user=>'<@'+user+'>').join(', ');
 return (shown+(users.length>18?' and '+(users.length-18)+' more':'')).slice(0,1024);
}
function payload(event,occurrence){
 const r=results(occurrence.key);
 const start=Math.floor(occurrence.start.getTime()/1000);
 const finish=occurrence.end?Math.floor(occurrence.end.getTime()/1000):null;
 const when='<t:'+start+':F> (<t:'+start+':R>)'+(finish?' – <t:'+finish+':t>':'');
 const location=event.entityMetadata?.location||event.channel?.name||(event.channelId?'<#'+event.channelId+'>':'See the Discord event');
 const embed=new EmbedBuilder()
  .setColor(0xd6b77f)
  .setTitle(event.name.slice(0,256))
  .setURL(eventUrl(event))
  .setDescription((event.description||'Join us for this event.').slice(0,4096))
  .addFields(
   {name:'When',value:when.slice(0,1024)},
   {name:'Location',value:String(location).slice(0,1024)},
   {name:'Accepted ('+r.yes.length+')',value:names(r.yes)},
   {name:'Declined ('+r.no.length+')',value:names(r.no)},
   {name:'Tentative ('+r.maybe.length+')',value:names(r.maybe)}
  )
  .setFooter({text:event.recurrenceRule?.frequency===2?'Weekly occurrence • RSVP for this date only':'Discord Scheduled Event • RSVP'});
 if(event.image)embed.setImage(event.coverImageURL({size:1024}));
 return {embeds:[embed],components:buttons(occurrence.key),allowedMentions:{parse:[]}};
}
async function announcementChannel(){
 const channel=await client.channels.fetch(channelId);
 if(!channel?.isTextBased()||!('send' in channel))throw new Error('Destination must be a text channel that the bot can write in');
 return channel;
}
// Only one public message per event series. Existing per-week RSVP votes remain
// separate; old messages from the earlier multi-post implementation are removed.
async function upsert(event,occurrence){
 return serialized(event.id,async()=>{
  const channel=await announcementChannel();
  const existingKeys=Object.keys(state.messages).filter(k=>k===event.id||parseKey(k)?.id===event.id);
  let keepKey=event.id;
  let messageId=state.messages[keepKey];
  if(!messageId&&existingKeys.length){
   // Keep the announcement for the currently displayed/nearest date if possible.
   const preferred=existingKeys.includes(occurrence.key)?occurrence.key:existingKeys.sort((x,y)=>{
    const xa=parseKey(x)?.seconds||0,ya=parseKey(y)?.seconds||0;
    return Math.abs(xa-occurrence.start.getTime()/1000)-Math.abs(ya-occurrence.start.getTime()/1000);
   })[0];
   messageId=state.messages[preferred];
   state.messages[keepKey]=messageId;
   persist();
  }
  // Clean up the accidental flood, keeping only the single retained message.
  for(const key of existingKeys){
   if(key===keepKey)continue;
   const redundantId=state.messages[key];
   if(redundantId&&redundantId!==messageId){
    try{await (await channel.messages.fetch(redundantId)).delete()}
    catch(error){if(error.code!==10008){console.error('Cannot remove duplicate event announcement',key,error.message);continue}}
   }
   delete state.messages[key];
   // Do NOT delete state.votes[key]: these are specific to the dated occurrence.
   persist();
  }
  const body=payload(event,occurrence);
  if(messageId){
   try{const existing=await channel.messages.fetch(messageId);await existing.edit(body);return}
   catch(error){if(error.code!==10008)throw error}
  }
  const message=await channel.send(body);
  state.messages[keepKey]=message.id;
  persist();
  console.log('Posted single event announcement',event.id,event.name);
 });
}
async function remove(key){
 const id=parseKey(key)?.id||key;
 return serialized(id,async()=>{
  if(state.messages[key]){
   try{
    const channel=await announcementChannel();
    const message=await channel.messages.fetch(state.messages[id]);
    await message.delete();
   }catch(error){if(error.code!==10008&&error.code!==10003)throw error}
  }
  delete state.messages[key];
  // Keep historical per-occurrence RSVP responses in local storage.
  persist();
 });
}
let reconciling=false;
async function reconcile(){
 if(reconciling)return;
 reconciling=true;
 try{
  const guild=await client.guilds.fetch(guildId);
  const events=await guild.scheduledEvents.fetch();
  const keep=new Set();
  const jobs=[];
  for(const event of events.values()){
   if(event.status!==1&&event.status!==2)continue;
   for(const item of occurrences(event)){
    keep.add(event.id);
    jobs.push([event,item]);
   }
  }
  // Avoid hammering Discord or exceeding rate limits when many events exist.
  for(const [event,item] of jobs){
   try{await upsert(event,item)}catch(error){console.error('Failed to publish',item.key,error.message)}
  }
  for(const key of Object.keys(state.messages)){
   if(!keep.has(key)){
    try{await remove(key)}catch(error){console.error('Failed to remove',key,error.message)}
   }
  }
  console.log('Active event announcements:',keep.size);
 }catch(error){console.error('Discord event reconciliation failed:',error.message)}
 finally{reconciling=false}
}
client.once(Events.ClientReady,async()=>{
 console.log('Event bot connected as',client.user.tag);
 try{
  const channel=await announcementChannel();
  const permissions=channel.permissionsFor(client.user);
  if(!permissions?.has([PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages,PermissionsBitField.Flags.EmbedLinks,PermissionsBitField.Flags.ReadMessageHistory])){
   console.error('Event channel requires View Channel, Send Messages, Embed Links and Read Message History permissions');
  }
  await reconcile();
 }catch(error){console.error('Startup error',error.message)}
 setInterval(reconcile,5*60*1000).unref();
});
client.on(Events.GuildScheduledEventCreate,()=>reconcile().catch(console.error));
client.on(Events.GuildScheduledEventUpdate,()=>reconcile().catch(console.error));
client.on(Events.GuildScheduledEventDelete,()=>reconcile().catch(console.error));
client.on(Events.InteractionCreate,async interaction=>{
 if(!interaction.isButton())return;
 const match=/^rsvp:(\d{15,25}):(\d{9,12}):(yes|no|maybe)$/.exec(interaction.customId);
 if(!match||interaction.guildId!==guildId)return;
 const [,id,seconds,choice]=match;
 const key=id+':'+seconds;
 await interaction.deferReply({ephemeral:true});
 if(!state.messages[id]){
  await interaction.editReply('That event is no longer announced.');
  return;
 }
 try{
  await serialized(id,async()=>{
   const guild=await client.guilds.fetch(guildId);
   const event=await guild.scheduledEvents.fetch(id);
   if(!event||![1,2].includes(event.status))throw Error('Event has ended or been removed');
   const occurrence=occurrences(event)[0];
   if(!occurrence||occurrence.key!==key)throw Error('This date is no longer available');
   const previous=votesFor(key);
   const updated={...previous};
   if(updated[interaction.user.id]===choice)delete updated[interaction.user.id];
   else updated[interaction.user.id]=choice;
   state.votes[key]=updated;
   persist();
   const channel=await announcementChannel();
   const message=await channel.messages.fetch(state.messages[key]);
   await message.edit(payload(event,occurrence));
  });
  await interaction.editReply('Your RSVP for this date is saved. Press your selected response again to clear it. Discord native Interested is separate.');
 }catch(error){console.error('RSVP update failed',key,error.message);await interaction.editReply('Could not update this event RSVP. Please try again.')}
});
client.on(Events.Error,error=>console.error('Discord:',error.message));
process.on('SIGINT',()=>{client.destroy();process.exit(0)});
process.on('SIGTERM',()=>{client.destroy();process.exit(0)});
client.login(token).catch(error=>{console.error('Bot login failed',error.message);process.exit(1)});
