import React,{useEffect,useState} from 'react';
import './public-site.css';

const NAV=[
 ['about','The Order'],
 ['history','Our History'],
 ['ranks','Hierarchy'],
 ['roleplay','Roleplay'],
 ['membership','Membership'],
 ['questions','Questions']
];
const RANKS=[
 {name:'Domina',title:'The authority at the eclipse',symbol:'✦',text:'The Order answers to one sovereign voice. Its direction, alliances, and final decisions rest here.'},
 {name:'Oyabun',title:'The inner command',symbol:'◆',text:'Senior officers entrusted with the Order’s operations, people, and difficult decisions.'},
 {name:'Kusushi',title:'The chosen specialists',symbol:'✧',text:'Alchemists, enforcers, and skilled agents whose work demands expertise or discretion.'},
 {name:'Operative',title:'The hands of the Order',symbol:'◇',text:'Members entrusted with assignments, expeditions, intelligence, and the daily life of the syndicate.'},
 {name:'Kumi-in / Initiate',title:'The first step within',symbol:'◈',text:'New arrivals who have yet to earn their place, loyalties, and responsibilities.'}
];
const FAQ=[
 {q:'What kind of FFXIV group is this?',a:'The Eclipse Order is a story-focused Final Fantasy XIV roleplay free company built around a morally dark syndicate. We tell stories about loyalty, ambition, consequence, and the people caught between them.'},
 {q:'Do I need to know the Order’s history?',a:'No. New characters do not need to have been present for past events. You can arrive knowing only rumors and discover the Order through roleplay.'},
 {q:'Do I need to play a villain?',a:'Not necessarily. The Order includes characters with different loyalties, talents, motives, and personal boundaries. What matters is that your character has a believable reason to become involved.'},
 {q:'How do events and character sheets work?',a:'Members use a companion portal for character dossiers, event registrations, and the Order’s dice-based encounters. Roleplay still takes place in Final Fantasy XIV.'},
 {q:'Can my character have a different rank from my account role?',a:'Yes. In-character standing is separate from out-of-character site permissions and moderation responsibilities.'},
 {q:'How do I request membership?',a:'Use Request membership to create an account. Access is reviewed by Order command before the member portal becomes available.'}
];
const MODES=[
 {name:'Story',mark:'I',heading:'The Order remembers.',body:'An arrangement made in one scene may change the next. Rivalries, debts, fragile trust, and personal loyalties build an ongoing shared story.'},
 {name:'Events',mark:'II',heading:'Every assignment has stakes.',body:'Posted events can carry a difficulty rating, an impact rating, and a sequence of chapters. FC MSQ marks the stories that advance the Order’s central narrative.'},
 {name:'Combat',mark:'III',heading:'A tabletop beneath the tale.',body:'The companion portal brings together level-based jobs, character sheets, dice checks, initiative, and tactical encounters. DMs can direct enemies and allied NPCs.'}
];
function Mark({className=''}){return <span className={'public-mark '+className} aria-hidden="true"><span className="public-mark-orbit"/><span className="public-mark-core">✦</span></span>}
function SectionTag({number,children}){return <div className="public-section-tag"><span>{number}</span><i/><span>{children}</span></div>}
export default function PublicSite(){
 const [menuOpen,setMenuOpen]=useState(false);
 const [letterOpen,setLetterOpen]=useState(false);
 const [mode,setMode]=useState(0);
 const [expandedFAQ,setExpandedFAQ]=useState(-1);
 useEffect(()=>{
  document.title='The Eclipse Order — A Final Fantasy XIV Roleplay Free Company';
  const handleEscape=e=>{if(e.key==='Escape'){setLetterOpen(false);setMenuOpen(false)}};
  window.addEventListener('keydown',handleEscape);
  return()=>window.removeEventListener('keydown',handleEscape);
 },[]);
 const closeMenu=()=>setMenuOpen(false);
 return <div className="order-public">
  <a href="#content" className="public-skip">Skip to content</a>
  <header className="public-header">
   <a href="#home" className="public-brand" aria-label="The Eclipse Order home" onClick={closeMenu}><Mark/><span><strong>The Eclipse Order</strong><small>FINAL FANTASY XIV · ROLEPLAY</small></span></a>
   <nav aria-label="Public site" className={'public-nav '+(menuOpen?'open':'')}>{NAV.map(([id,title])=><a key={id} href={'#'+id} onClick={closeMenu}>{title}</a>)}<a className="public-mobile-portal" href="?portal">Member sign-in</a></nav>
   <div className="public-header-actions"><a className="public-portal-link" href="?portal">Member sign-in</a><a className="public-top-cta" href="?portal">Request membership <span aria-hidden="true">↗</span></a></div>
   <button className="public-menu-toggle" type="button" onClick={()=>setMenuOpen(x=>!x)} aria-expanded={menuOpen} aria-label={menuOpen?'Close navigation':'Open navigation'}>{menuOpen?'✕':'☰'}</button>
  </header>
  <main id="content">
   <section className="public-hero" id="home">
    <div className="public-hero-geometry" aria-hidden="true"><div className="public-hero-ring"/><div className="public-hero-disk"/><div className="public-hero-stars">✦</div></div>
    <div className="public-hero-content">
     <span className="public-kicker"><span className="public-kicker-line"/> A SHADOW OVER HYDAELYN</span>
     <h1>Some loyalties<br/>are forged <em>in darkness.</em></h1>
     <p className="public-hero-subtitle">An FFXIV roleplay free company of dangerous bargains, uncertain allegiances, and stories that refuse to be forgotten.</p>
     <div className="public-hero-cta"><a href="#about" className="public-button-primary">Discover the Order <span aria-hidden="true">↗</span></a><button type="button" className="public-button-ghost" onClick={()=>setLetterOpen(true)}>Read the invitation <span aria-hidden="true">◇</span></button></div>
     <div className="public-hero-notes"><span>STORY-FOCUSED ROLEPLAY</span><span>FINAL FANTASY XIV</span><span>MEMBER-RUN EVENTS</span></div>
    </div>
    <div className="public-scroll-cue" aria-hidden="true"><span>DESCEND INTO THE ORDER</span><i/></div>
   </section>
   <section className="public-section public-introduction" id="about">
    <div className="public-section-inner">
     <SectionTag number="01">THE ORDER</SectionTag>
     <div className="public-intro-grid"><div><h2>Not heroes.<br/><em>Not quite monsters.</em></h2></div><div className="public-intro-copy"><p className="public-lead">The Eclipse Order is a clandestine syndicate within the world of Final Fantasy XIV. Its members live by uneasy loyalties, quiet ambition, and the belief that power is rarely handed to those who deserve it.</p><p>Our roleplay is character-driven and continuous. The Order is a setting for intrigue, alliances, personal conflicts, dangerous expeditions, and the small moments that make a family out of people who never expected to belong anywhere.</p><a className="public-text-link" href="#roleplay">How our stories work <span aria-hidden="true">↗</span></a></div></div>
     <div className="public-principles">
      <article><span>Ⅰ</span><h3>Consequences matter</h3><p>The decisions characters make leave an impression on the people and stories around them.</p></article>
      <article><span>Ⅱ</span><h3>Every role has weight</h3><p>Not everyone commands an army. Intelligence, diplomacy, artistry, and quiet loyalty all have their place.</p></article>
      <article><span>Ⅲ</span><h3>The story is shared</h3><p>There is no single chosen protagonist. Members help shape the world their characters inhabit.</p></article>
     </div>
    </div>
   </section>
   <section className="public-section public-history" id="history">
    <div className="public-section-inner">
     <SectionTag number="02">A HISTORY WRITTEN IN SHADOW</SectionTag>
     <div className="public-history-grid"><div className="public-history-art" aria-hidden="true"><div className="public-history-seal"><Mark/><span>THE ECLIPSE<br/>ENDURES</span></div><span className="public-art-caption">THE SERPENT · THE ECLIPSE · THE OATH</span></div>
      <div><h2>Before the Order,<br/><em>there was a household.</em></h2><p className="public-lead">Its roots reach back to the Thirteenth, where the remnants of Elira’s noble household endured the Flood of Darkness.</p><p>Traditions survived when so much else did not. What began as a circle of scattered loyalties eventually took shape as a syndicate in Yanxia, where formal ranks emerged during the Stormblood era.</p><p>The Final Days broke more than kingdoms. The Order itself fell silent for a time, its leader absent and its remaining bonds scattered. But some stories are not so easily laid to rest.</p><div className="public-history-quote">“An eclipse is not an ending. It is the moment before the light returns.”</div></div>
     </div>
    </div>
   </section>
   <section className="public-section public-hierarchy" id="ranks">
    <div className="public-section-inner">
     <SectionTag number="03">THE HIERARCHY</SectionTag>
     <div className="public-section-heading"><div><h2>Five ranks.<br/><em>One Order.</em></h2></div><p>Authority is earned, delegated, and sometimes contested. Every rank carries its own expectations within the syndicate.</p></div>
     <div className="public-rank-list">{RANKS.map((rank,index)=><article className="public-rank" key={rank.name}><span className="public-rank-index">0{index+1}</span><span className="public-rank-symbol" aria-hidden="true">{rank.symbol}</span><div><h3>{rank.name}</h3><small>{rank.title}</small></div><p>{rank.text}</p></article>)}</div>
     <p className="public-footnote">These ranks describe the characters’ place in the Order. Site administration and community moderation are handled separately.</p>
    </div>
   </section>
   <section className="public-section public-play" id="roleplay">
    <div className="public-section-inner">
     <SectionTag number="04">HOW WE ROLEPLAY</SectionTag>
     <div className="public-section-heading"><div><h2>A world beyond<br/><em>the character sheet.</em></h2></div><p>Roleplay happens in-game. Our companion portal gives the shared story a place to keep its characters, assignments, and encounters together.</p></div>
     <div className="public-play-stage">
      <div className="public-play-tabs" role="tablist" aria-label="Roleplay experiences">{MODES.map((item,i)=><button role="tab" id={'mode-tab-'+i} aria-controls="mode-panel" aria-selected={mode===i} type="button" className={mode===i?'active':''} key={item.name} onClick={()=>setMode(i)}><span>{item.mark}</span>{item.name}</button>)}</div>
      <div className="public-play-content" role="tabpanel" id="mode-panel" aria-labelledby={'mode-tab-'+mode}><div><span className="public-play-eyebrow">{MODES[mode].mark} / THE EXPERIENCE</span><h3>{MODES[mode].heading}</h3><p>{MODES[mode].body}</p><a className="public-text-link" href="?portal">Explore the member portal <span aria-hidden="true">↗</span></a></div><div className={'public-play-symbol public-play-symbol-'+mode} aria-hidden="true">{mode===0?'◇':mode===1?'✦':'⚔'}</div></div>
     </div>
     <div className="public-play-details">
      <article><span>01</span><h3>Character dossiers</h3><p>Keep your character’s identity, class, abilities, and progress in one place.</p></article>
      <article><span>02</span><h3>Event chapters</h3><p>Join story events, including FC MSQ arcs that move the Order’s main narrative forward.</p></article>
      <article><span>03</span><h3>Dice & encounters</h3><p>Settle uncertain outcomes with custom dice rules, initiative, and a tactical battle map.</p></article>
     </div>
    </div>
   </section>
   <section className="public-section public-conduct" id="conduct">
    <div className="public-section-inner">
     <SectionTag number="05">BEYOND THE MASK</SectionTag>
     <div className="public-conduct-grid"><div><h2>Dark stories.<br/><em>Clear boundaries.</em></h2></div><div><p className="public-lead">The Order can be ruthless in-character. Our community should never be.</p><p>Character conflict is not player conflict. We expect members to respect consent, keep in-character and out-of-character matters separate, and collaborate before imposing lasting consequences on another person’s character.</p><p>The strongest stories are possible when everyone involved knows where their boundaries lie.</p><div className="public-conduct-principles"><span>CONSENT</span><span>RESPECT</span><span>COMMUNICATION</span></div></div></div>
    </div>
   </section>
   <section className="public-section public-membership" id="membership">
    <div className="public-section-inner">
     <SectionTag number="06">THE DOOR IS OPEN</SectionTag>
     <div className="public-membership-grid"><div><h2>Every oath begins<br/><em>with a choice.</em></h2><p>Whether you arrive as an ambitious operative, a quiet specialist, or someone with nowhere else left to go, the story begins when you decide to knock.</p><a className="public-button-primary" href="?portal">Request membership <span aria-hidden="true">↗</span></a><span className="public-membership-note">Membership requests are reviewed before portal access is granted.</span></div>
      <div className="public-membership-steps">{[{title:'Introduce yourself',text:'Create a membership request through the portal.'},{title:'Meet the Order',text:'Order command reviews the request and can discuss how your character may fit.'},{title:'Begin your story',text:'Once approved, build your character dossier and explore the Order’s events.'}].map((step,i)=><div className="public-membership-step" key={step.title}><span>0{i+1}</span><div><h3>{step.title}</h3><p>{step.text}</p></div></div>)}</div>
     </div>
    </div>
   </section>
   <section className="public-section public-faq" id="questions">
    <div className="public-section-inner">
     <SectionTag number="07">QUESTIONS BEFORE THE OATH</SectionTag>
     <div className="public-section-heading"><h2>What would you<br/><em>like to know?</em></h2><p>An invitation should come with a few answers.</p></div>
     <div className="public-faq-list">{FAQ.map((entry,i)=><div key={entry.q} className={'public-faq-item '+(expandedFAQ===i?'open':'')}><button type="button" aria-expanded={expandedFAQ===i} onClick={()=>setExpandedFAQ(expandedFAQ===i?-1:i)}><span>{entry.q}</span><span aria-hidden="true">{expandedFAQ===i?'−':'+'}</span></button>{expandedFAQ===i&&<p>{entry.a}</p>}</div>)}</div>
    </div>
   </section>
   <footer className="public-footer"><div className="public-footer-upper"><div><Mark/><h2>The Eclipse Order</h2><p>Under the eclipse, our stories endure.</p></div><div><span>EXPLORE</span><a href="#about">The Order</a><a href="#history">Our History</a><a href="#ranks">Hierarchy</a><a href="#roleplay">Roleplay</a></div><div><span>ENTER</span><a href="#membership">Membership</a><a href="?portal">Member sign-in</a><a href="#questions">Questions</a></div></div><div className="public-footer-lower"><span>© {new Date().getFullYear()} The Eclipse Order</span><span>A Final Fantasy XIV roleplay community. FINAL FANTASY XIV © SQUARE ENIX. Not affiliated with Square Enix.</span><a href="#home">Back to the top ↑</a></div></footer>
  </main>
  {letterOpen&&<div className="public-letter-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setLetterOpen(false)}}><div className="public-letter" role="dialog" aria-modal="true" aria-labelledby="invitation-title"><button type="button" aria-label="Close invitation" className="public-letter-close" onClick={()=>setLetterOpen(false)}>✕</button><Mark/><span className="public-letter-kicker">A LETTER WITHOUT A SIGNATURE</span><h2 id="invitation-title">To the one who found this.</h2><p>Rumors have a way of reaching the people they are meant for. Perhaps you followed one here. Perhaps you had nowhere else to turn. The Order does not care how the first thread came into your hands.</p><p>What matters is what you do with it.</p><p>There is a place for those who understand the cost of loyalty, and for those willing to learn. But understand this: nothing worth carrying comes without weight.</p><p className="public-letter-signoff">— Beneath the Eclipse</p><button type="button" className="public-button-primary" onClick={()=>{setLetterOpen(false);document.querySelector('#about')?.scrollIntoView({behavior:'smooth'})}}>Read the Order’s story <span aria-hidden="true">↗</span></button></div></div>}
 </div>;
}
