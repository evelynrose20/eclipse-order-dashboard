// Self-hosted Discord scheduled-event announcements. No third-party event service.
import { Client, GatewayIntentBits, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionsBitField } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const token=process.env.DISCORD_BOT_TOKEN;
const guildId=process.env.DISCORD_GUILD_ID;
const channelId=process.env.DISCORD_EVENT_ANNOUNCEMENT_CHANNEL_ID;
const validId=x=>typeof x==='string'&&/^\d{15,25}$/.test(x);
if(!token||!validId(guildId)||!validId(channelId)){
 console.error('Set DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, and DISCORD_EVENT_ANNOUNCEMENT_CHANNEL_ID in server/.env.');
 process.exit(1);
}
const dataDirectory=path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'.eclipse-order'),'EclipseOrder','EventBot');
fs.mkdirSync(dataDirectory,{recursive:true});
const statePath=path.join(dataDirectory,'announcements.json');
let state={messages:{},votes:{}};
try{
 const loaded=JSON.parse(fs.readFileSync(statePath,'utf8'));
 if(loaded&&typeof loaded==='object')state={messages:loaded.messages||{},votes:loaded.votes||{}};
}catch(error){if(error.code!=='ENOENT'){console.error('Cannot load event mapping:',error.message);process.exit(1)}}
const persist=()=>{
 const temporary=statePath+'.tmp';
 fs.writeFileSync(temporary,JSON.stringify(state,null,2),'utf8');
 fs.renameSync(temporary,statePath);
};
const client=new Client({intents:[GatewayIntentBits.Guilds]});
const queue=new Map();
function serialize(key,operation){
 const prior=queue.get(key)||Promise.resolve();
 const next=prior.catch(()=>{}).then(operation);
 queue.set(key,next);
 next.finally(()=>{if(queue.get(key)===next)queue.delete(key)}).catch(()=>{});
 return next;
}
const eventUrl=event=>`https://discord.com/events/${event.guildId}/${event.id}`;
function counts(id){
 const tally={yes:0,no:0,maybe:0};
 for(const value of Object.values(state.votes[id]||{})){if(Object.hasOwn(tally,value))tally[value]++}
 return tally;
}
function components(id){
 const tally=counts(id);
 return [new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('event-rsvp:'+id+':yes').setLabel('Accepted ('+tally.yes+')').setEmoji('✅').setStyle(ButtonStyle.Success),
  new ButtonBuilder().setCustomId('event-rsvp:'+id+':no').setLabel('Declined ('+tally.no+')').setEmoji('❌').setStyle(ButtonStyle.Danger),
  new ButtonBuilder().setCustomId('event-rsvp:'+id+':maybe').setLabel('Tentative ('+tally.maybe+')').setEmoji('❔').setStyle(ButtonStyle.Primary)
 )];
}
function eventPayload(event){
 const start=event.scheduledStartAt;
 const end=event.scheduledEndAt;
 const location=event.entityMetadata?.location||event.channel?.name||(event.channelId?`<#${event.channelId}>`:'See the Discord event');
 const status=event.status===2?'In progress':event.status===3?'Completed':event.status===4?'Cancelled':'Scheduled';
 const when=start?`<t:${Math.floor(start.getTime()/1000)}:F> (<t:${Math.floor(start.getTime()/1000)}:R>)${end?` – <t:${Math.floor(end.getTime()/1000)}:t>`:''}`:'Not set';
 const embed=new EmbedBuilder().setColor(event.status===4?0x9f5656:0xd6b77f)
  .setTitle(event.name.slice(0,256)).setURL(eventUrl(event))
  .setDescription((event.description||'Join us for this event.').slice(0,4096))
  .addFields({name:'Time',value:when.slice(0,1024)},{name:'Location',value:String(location).slice(0,1024)},{name:'Status',value:status})
  .setFooter({text:'Eclipse Order • Synced from Discord Scheduled Events'});
 if(event.image)embed.setImage(event.coverImageURL({size:1024}));
 return {embeds:[embed],components:event.status===3||event.status===4?[]:components(event.id),allowedMentions:{parse:[]}};
}
async function announcementChannel(){
 const channel=await client.channels.fetch(channelId);
 if(!channel?.isTextBased()||!('send' in channel))throw new Error('Announcement channel must be a writable Discord text channel');
 return channel;
}
async function upsert(event){
 if(event.guildId!==guildId)return;
 return serialize(event.id,async()=>{
  const channel=await announcementChannel();
  const payload=eventPayload(event);
  const messageId=state.messages[event.id];
  if(messageId){
   try{const existing=await channel.messages.fetch(messageId);await existing.edit(payload);return}
   catch(error){if(error.code!==10008)throw error}
  }
  const message=await channel.send(payload);
  state.messages[event.id]=message.id;persist();
  console.log('Posted event',event.id,event.name);
 });
}
async function remove(id){
 return serialize(id,async()=>{
  const messageId=state.messages[id];
  if(messageId){
   try{const channel=await announcementChannel();const message=await channel.messages.fetch(messageId);await message.delete()}
   catch(error){if(error.code!==10008&&error.code!==10003)console.error('Cannot delete old announcement:',error.message)}
  }
  delete state.messages[id];delete state.votes[id];persist();
 });
}
let syncing=false;
async function reconcile(){
 if(syncing)return;
 syncing=true;
 try{
  const guild=await client.guilds.fetch(guildId);
  const events=await guild.scheduledEvents.fetch();
  const active=new Set();
  for(const event of events.values()){
   if(event.status!==1&&event.status!==2)continue;
   active.add(event.id);
   await upsert(event).catch(error=>console.error('Event sync failed',event.id,error.message));
  }
  // A cancelled, completed, or deleted event no longer belongs on the upcoming board.
  for(const id of Object.keys(state.messages))if(!active.has(id))await remove(id);
  console.log('Event sync finished; active events:',active.size);
 }catch(error){console.error('Event sync failed:',error.message)}
 finally{syncing=false}
}
client.once(Events.ClientReady,async()=>{
 console.log('Event bot ready:',client.user.tag);
 try{
  const channel=await announcementChannel();
  const permissions=channel.permissionsFor(client.user);
  if(!permissions?.has([PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages,PermissionsBitField.Flags.EmbedLinks,PermissionsBitField.Flags.ReadMessageHistory])){
   console.error('Bot needs View Channel, Send Messages, Embed Links and Read Message History in the announcement channel.');
  }
  await reconcile();
 }catch(error){console.error('Startup check failed:',error.message)}
 setInterval(reconcile,5*60*1000).unref();
});
client.on(Events.GuildScheduledEventCreate,event=>upsert(event).catch(error=>console.error('Create:',error.message)));
client.on(Events.GuildScheduledEventUpdate,(_old,event)=>{
 if(event.status===3||event.status===4)remove(event.id).catch(error=>console.error('Remove:',error.message));
 else upsert(event).catch(error=>console.error('Update:',error.message));
});
client.on(Events.GuildScheduledEventDelete,event=>remove(event.id).catch(error=>console.error('Delete:',error.message)));
client.on(Events.InteractionCreate,async interaction=>{
 if(!interaction.isButton()||!interaction.customId.startsWith('event-rsvp:'))return;
 const match=/^event-rsvp:(\d{15,25}):(yes|no|maybe)$/.exec(interaction.customId);
 if(!match||interaction.guildId!==guildId)return;
 const [,id,choice]=match;
 if(!state.messages[id]){await interaction.reply({content:'This event is no longer available.',ephemeral:true});return}
 await interaction.deferReply({ephemeral:true});
 try{
  await serialize(id,async()=>{
   const votes=state.votes[id]||(state.votes[id]={});
   const old=votes[interaction.user.id];
   if(old===choice)delete votes[interaction.user.id];else votes[interaction.user.id]=choice;
   persist();
   const channel=await announcementChannel();
   const message=await channel.messages.fetch(state.messages[id]);
   const guild=await client.guilds.fetch(guildId);
   const event=await guild.scheduledEvents.fetch(id);
   if(!event)throw new Error('Event no longer exists');
   await message.edit(eventPayload(event));
  });
  await interaction.editReply('Your response has been recorded. Click the same option again to clear it. This response is for the announcement; Discord’s native Interested button is separate.');
 }catch(error){console.error('RSVP update:',error.message);await interaction.editReply('Could not save your response. Please try again.')}
});
client.on(Events.Error,error=>console.error('Discord client:',error.message));
process.on('SIGINT',()=>{client.destroy();process.exit(0)});
process.on('SIGTERM',()=>{client.destroy();process.exit(0)});
client.login(token).catch(error=>{console.error('Discord login failed:',error.message);process.exit(1)});
