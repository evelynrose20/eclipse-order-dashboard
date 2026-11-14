import React from 'react';
import './discord-access-page.css';

const CONTENT={
 discord_not_in_server:{
  label:'DISCORD MEMBERSHIP',
  title:'The door is not open yet.',
  text:'Imperium Noctis could not find your Discord account in its configured server. If you already belong to the server, do not request another invitation. Ask Imperial command to check the Discord server ID and bot configuration.',
  detail:'If this is your first visit, you can request an invitation using Discord. Joining still requires Order approval.'
 },
 discord_membership_screening:{
  label:'DISCORD SCREENING',
  title:'One more step within Discord.',
  text:'Your Discord account has reached the server, but membership screening is not complete.',
  detail:'Open the Discord server and accept its rules or complete any remaining membership questions, then try signing in again.'
 },
 discord_guild_configuration_error:{
  label:'CONNECTION PROBLEM',
  title:'Imperium Noctis cannot confirm the server.',
  text:'The Discord bot cannot verify the configured server or access its membership records. This does not mean you are outside the Discord.',
  detail:'Order command needs to check that DISCORD_GUILD_ID is the correct server ID, and that the configured bot token belongs to the application with that bot inside the server.'
 },
 discord_server_check_unavailable:{
  label:'DISCORD TEMPORARILY UNAVAILABLE',
  title:'We cannot verify your place yet.',
  text:'Discord or the membership-check service is unavailable. We cannot grant access until it can confirm your membership.',
  detail:'Please try again later. You do not need to leave or rejoin the Discord server.'
 },
 pending:{
  label:'APPLICATION RECEIVED',
  title:'Your request is with Imperium Noctis.',
  text:'Your Discord membership is verified. Order command still needs to approve your website membership.',
  detail:'You do not need to apply again. Your character records and access will be available once the request is approved.'
 }
};
export default function DiscordAccessPage({reason,onRetry,onJoin,busy,adult,onAdultChange,onBack}){
 const detail=CONTENT[reason]||CONTENT.discord_server_check_unavailable;
 return <div className="eo-discord-access">
  <div className="eo-discord-access-art" aria-hidden="true"><span><i className="fa-solid fa-shield-halved"/></span></div>
  <div className="eo-discord-access-inner">
   <span className="eo-discord-access-eyebrow">IMPERIUM NOCTIS / {detail.label}</span>
   <h1>{detail.title}</h1>
   <p className="eo-discord-access-lead">{detail.text}</p>
   <div className="eo-discord-access-detail"><strong>What happens next</strong><p>{detail.detail}</p></div>
   {reason!=='pending'&&<div className="eo-discord-access-choice">
    <label><input type="checkbox" checked={adult} onChange={e=>onAdultChange(e.target.checked)}/> I confirm that I am 18 or older and understand this is a Bad End RP community.</label>
    {reason==='discord_not_in_server'&&<><button type="button" className="eo-discord-access-join" disabled={busy||!adult} onClick={onJoin}>Request to join Imperium Noctis’s Discord</button><small>Discord will ask your permission before the bot attempts to add you. This does not grant website approval.</small></>}
   </div>}
   <div className="eo-discord-access-actions">
    {reason!=='pending'&&<button type="button" disabled={busy||!adult} onClick={onRetry}>Verify with Discord again</button>}
    <button type="button" onClick={onBack}>Back to sign-in</button>
    <a href="./">Return to public site</a>
   </div>
  </div>
 </div>;
}
