import React,{useEffect} from 'react';
import './imperial-theme.css';
import './venue-site.css';
import './venue-rules.css';
import OrderEmblem from './OrderEmblem.jsx';

const DISCORD_INVITE='https://discord.gg/ksqTw4SHYn';
const RULE_SECTIONS=[
 {id:'conduct',title:'Venue Conduct',eyebrow:'01 / HOUSE EXPECTATIONS',items:[
  {title:'Conduct Within the Eclipse',paragraphs:['The Midnight Eclipse is a private, high-end venue. Guests are expected to behave accordingly. Disruptive behavior, public scenes, or overt hostility will not be tolerated.','Venue staff may refuse service or ask a guest to leave when necessary.']},
  {title:'Respect the Staff',paragraphs:['Staff and attendants must be treated with respect. In-character aggression, coercion, or disrespect directed toward staff is grounds for removal.','On-duty staff have authority over the venue and may end a scene or remove a guest.']},
  {title:'Consent & Boundaries — Staff Interactions',paragraphs:['Consent is mandatory for interactions with staff. Do not touch, proposition, or escalate roleplay without clear agreement from the people involved.','In-character agreement never replaces out-of-character consent. If anyone withdraws consent, stop immediately.']},
  {title:'Violence & Conflict',paragraphs:['No combat, attacks, or forced conflict within the venue. Any hostile action must be approved in advance by staff and handled off-screen or through private roleplay, with all participants’ OOC consent.']},
  {title:'Substances & Services',paragraphs:['All food and drink prices are in-character gil only. Special services, rare items, and restricted offerings—including items not listed on the product menu—are staff-controlled and never guaranteed.','Attempting to bypass staff authority may result in removal.']},
  {title:'Confidentiality',paragraphs:['What happens within The Midnight Eclipse stays within The Midnight Eclipse. In-character information learned here should not be used or shared outside the scene without consent.']}
 ]},
 {id:'thralls',title:'In-Character Thrall Guidelines',eyebrow:'02 / HOUSEHOLD PROTOCOL',items:[
  {title:'Status & Authority',paragraphs:['In the setting, thralls are considered property of the Order rather than independent staff. Their in-character autonomy and privileges differ from those of staff members.','This is a fictional character status only; it does not remove any player’s OOC rights or boundaries.']},
  {title:'Guest Interaction',paragraphs:['Guests may interact with thralls in ways explicitly permitted by the venue and agreed to by the players involved. Access is a privilege, not an entitlement, and staff may revoke it at any time.','Thralls may be assigned to presentation, display, or service in accordance with the Order’s roleplay and everyone’s OOC consent.']},
  {title:'Custodian Authority',paragraphs:['In character, custodians and Order staff supervise all thralls. Guests must not interfere with staff-led discipline, correction, or reassignment scenes.','Staff may remove guests who disrupt venue operations. No in-character authority can override a player’s OOC consent.']},
  {title:'Thrall Night vs. Business Night',paragraphs:['Thrall Night — Fridays, 6 PM–2 AM Eastern: guests may interact openly with thralls; open ERP is permitted and expected, but nobody is obligated to participate. All players must agree OOC.','Business Night — Sundays, 6 PM–2 AM Eastern: strictly no ERP. Private, nonsexual conversations or business interactions may take place in designated rooms, party chat, or /tell. The evening is for business, requests, and audiences with Order leadership.']},
  {title:'Limits & Boundaries',paragraphs:['Thralls must not be harmed in a way that disrupts venue operations. No permanent injury, marking, or damage. All interactions are subject to staff oversight and may be ended at any time.','These in-character limits exist alongside—not instead of—the players’ OOC boundaries.']}
 ]},
 {id:'ooc',title:'Out-of-Character Rules',eyebrow:'03 / PLAYER SAFETY',items:[
  {title:'Respect Comes First',paragraphs:['Treat all players with respect. Harassment, discrimination, and unwanted advances are not tolerated.']},
  {title:'Consent Above All',paragraphs:['No ERP, fetish content, or heavy themes without clear out-of-character consent from every participant. “No” means no, without exception.','If someone seems uncomfortable or withdraws consent, stop immediately. In-character permission, a thrall role, or staff rank never substitutes for OOC consent.']},
  {title:'No Godmodding',paragraphs:['Do not control another player’s actions, reactions, or outcomes. Staff characters are controlled by their players only.']},
  {title:'Keep IC and OOC Separate',paragraphs:['Do not use OOC knowledge in roleplay. Do not treat in-character conflict as a personal dispute. Contact staff privately if a problem arises.']},
  {title:'Staff Authority',paragraphs:['Staff rulings apply during venue events. Raise concerns calmly and privately after the scene, or stop participating if you feel uncomfortable.']},
  {title:'Zero Tolerance Policy',paragraphs:['Harassment or hate speech, ignoring staff instructions, and attempts to force ERP or fetish content may result in immediate removal.']}
 ]}
];
function VenueMark(){return <span className="venue-mark" aria-hidden="true"><OrderEmblem className="venue-order-emblem"/></span>}
export default function VenueRules(){
 useEffect(()=>{document.title='Venue Rules — The Midnight Eclipse';return()=>{document.title='The Eclipse Order — A Final Fantasy XIV Roleplay Free Company'}},[]);
 return <div className="midnight-venue venue-rules-page">
  <a className="venue-skip" href="#venue-rules-main">Skip to venue rules</a>
  <header className="venue-header"><a className="venue-brand" href="/venue/"><VenueMark/><span>THE MIDNIGHT <em>ECLIPSE</em><small>AN ECLIPSE ORDER VENUE</small></span></a><nav aria-label="Venue rules navigation"><a href="/venue/">Venue home</a><a href="/venue/menu/">Menu</a><a href="/venue/people/">Our People</a><a href="#conduct">House rules</a><a href="#thralls">Thrall guidelines</a><a href="#ooc">OOC rules</a><a className="venue-nav-discord" href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">Join Discord <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"/></a></nav></header>
  <main id="venue-rules-main">
   <section className="venue-rules-hero"><div className="venue-inner"><span className="venue-eyebrow">THE MIDNIGHT ECLIPSE · HOUSE PROTOCOL</span><h1>RULES OF<br/><em>THE HOUSE.</em></h1><p>Entry into The Midnight Eclipse means respecting its staff, its guests, and the boundaries of the players behind every character. Read the house rules before taking part in venue roleplay.</p><nav className="venue-rules-jump" aria-label="Jump to rules section"><a href="#conduct">Venue conduct</a><a href="#thralls">IC thrall guidelines</a><a href="#ooc">OOC rules</a></nav></div></section>
   <div className="venue-rules-priority"><div className="venue-inner"><i className="fa-solid fa-shield-heart" aria-hidden="true"/><div><strong>OOC consent always takes precedence.</strong><p>ERP may be expected as part of Thrall Night’s atmosphere, but participation is never required. Business Night does not allow ERP, including in private rooms or chats during the event.</p></div></div></div>
   {RULE_SECTIONS.map((section,index)=><section className={'venue-section venue-rules-section venue-rules-'+section.id} key={section.id} id={section.id} aria-labelledby={'rules-heading-'+section.id}><div className="venue-inner"><div className="venue-section-top"><span className="venue-eyebrow">{section.eyebrow}</span><h2 id={'rules-heading-'+section.id}>{section.title}</h2></div><div className="venue-rules-grid">{section.items.map((item,i)=><article key={item.title} className="venue-rule-card"><div className="venue-rule-index">{String(index+1).padStart(2,'0')} / {String(i+1).padStart(2,'0')}</div><h3>{item.title}</h3>{item.paragraphs.map((paragraph,j)=><p key={j}>{paragraph}</p>)}</article>)}</div></div></section>)}
   <section className="venue-rules-outro"><div className="venue-inner"><div><span className="venue-eyebrow">QUESTIONS OR CONCERNS?</span><h2>Speak with<br/><em>the Order.</em></h2><p>Contact venue staff privately through our Discord to ask about the rules, discuss a scene, or report an issue.</p></div><a className="venue-btn venue-btn-primary" href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">Contact us on Discord <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"/></a></div></section>
  </main>
  <footer className="venue-footer"><div><VenueMark/><span>THE MIDNIGHT ECLIPSE<small>AN ECLIPSE ORDER VENUE</small></span></div><div><a href="/venue/">Venue home</a><a href="/venue/menu/">Menu</a><a href="/venue/people/">Staff & thralls</a><a href="#venue-rules-main">Back to top ↑</a></div><small>Final Fantasy XIV fan roleplay venue. Not affiliated with Square Enix.</small></footer>
 </div>;
}
