import React,{useEffect,useState} from 'react';
import './public-site.css';
import './imperial-theme.css';
import PublicChronicles from './PublicChronicles.jsx';
import OrderEmblem from './OrderEmblem.jsx';
import {SERVITUDE_RANKS} from './servitudeRanks.js';

const DISCORD_INVITE='https://discord.gg/ksqTw4SHYn';
const FC_ACTIVITIES=[
 {icon:'fa-flag',title:'War campaigns',subtitle:'Campaigns with lasting stakes',description:'Take part in unfolding military campaigns, territorial struggles, and the decisions that shape the Order’s future.'},
 {icon:'fa-chess-knight',title:'Political intrigue',subtitle:'Influence is its own battlefield',description:'Navigate negotiations, rival factions, shifting alliances, and schemes whose consequences reach beyond a single event.'},
 {icon:'fa-shield-halved',title:'Combat events',subtitle:'Fight for what matters',description:'Enter story-driven confrontations, tactical encounters, and dangerous missions where the outcome is not guaranteed.'},
 {icon:'fa-users',title:'Character gatherings',subtitle:'The stories between missions',description:'Share quieter moments, build relationships, and develop personal stories through informal member-led roleplay.'}
];
const RECRUITMENT_LABELS={open:'RECRUITMENT OPEN',limited:'LIMITED RECRUITMENT',closed:'RECRUITMENT CLOSED'};
const RECRUITMENT_API=(import.meta.env.VITE_ECLIPSE_API_URL||'').replace(/\/+$/,'');
const NAV=[
 ['about','The Order'],
 ['history','Our History'],
 ['chronicles','Chronicles'],

 ['ranks','Hierarchy'],
 ['roleplay','Roleplay'],
 ['activities','FC Activities'],
 ['bad-end','Bad End RP'],
 ['visit','Visit Us'],
 ['membership','Membership'],
 ['questions','Questions']
];
const ORDER_BRANCHES=[
 {name:'The Snakes',symbol:'fa-user-secret',summary:'Secrets, information, and the art of remaining unseen.',ranks:['Hatchling','Coil','Whisper','Shadowkeeper','High Serpent']},
 {name:'The Fangs',symbol:'fa-shield-halved',summary:'The Order’s strength, enforcement, and protection.',ranks:['Fangling','Fang','Viper','Fangmaster','High Fang']},
 {name:'The Golden Claws',symbol:'fa-coins',summary:'Commerce, resources, and the agreements that bind them.',ranks:['Gildling','Claw','Goldkeeper','Gilded Talon','High Claw']},
 {name:'The Household',symbol:'fa-building-columns',summary:'The people entrusted with the Order’s estate and inner workings.',ranks:['Keeper’s Apprentice','Overseer','Master of Chains','High Steward']}
];
const ESTATE=[['WORLD','Dynamis'],['DATA CENTER','Seraph'],['RESIDENTIAL DISTRICT','The Goblet'],['WARD','5'],['PLOT','41']];
const MODES=[
 {name:'Story',mark:'I',heading:'The Order remembers.',body:'An arrangement made in one scene may change the next. Rivalries, debts, fragile trust, and personal loyalties build an ongoing shared story.'},
 {name:'Events',mark:'II',heading:'Every assignment has stakes.',body:'Posted events can carry a difficulty rating, an impact rating, and a sequence of chapters. FC MSQ marks the stories that advance the Order’s central narrative.'},
 {name:'Combat',mark:'III',heading:'A tabletop beneath the tale.',body:'The companion portal brings together level-based jobs, character sheets, dice checks, initiative, and tactical encounters. DMs can direct enemies and allied NPCs.'}
];
function Mark({className=''}){return <span className={'public-mark '+className} aria-hidden="true"><OrderEmblem className="public-mark-emblem"/></span>}
function SectionTag({number,children}){return <div className="public-section-tag"><span>{number}</span><i/><span>{children}</span></div>}
export default function PublicSite(){
 const [menuOpen,setMenuOpen]=useState(false);
 const [letterOpen,setLetterOpen]=useState(false);
 const [mode,setMode]=useState(0);
 const [expandedFAQ,setExpandedFAQ]=useState(null);
 const [faqEntries,setFaqEntries]=useState([]),[faqStatus,setFaqStatus]=useState('loading');
 useEffect(()=>{
  let active=true;
  const controller=new AbortController();
  async function loadFaq(){
   try{
    const response=await fetch(RECRUITMENT_API+'/faq/public',{cache:'no-store',signal:controller.signal});
    if(!response.ok)throw new Error('unavailable');
    const data=await response.json();
    if(active){setFaqEntries(data.entries||[]);setFaqStatus('ready')}
   }catch(error){if(active&&error.name!=='AbortError')setFaqStatus('unavailable')}
  }
  void loadFaq();
  const onVisible=()=>{if(document.visibilityState==='visible')void loadFaq()};
  document.addEventListener('visibilitychange',onVisible);
  return()=>{active=false;controller.abort();document.removeEventListener('visibilitychange',onVisible)};
 },[]);
 const [addressCopied,setAddressCopied]=useState(false);
 const [recruitment,setRecruitment]=useState(null);
 const [recruitmentReason,setRecruitmentReason]=useState(''),[recruitmentReopens,setRecruitmentReopens]=useState(null),[reopeningNote,setReopeningNote]=useState('');
 useEffect(()=>{
  let active=true;
  const controller=new AbortController();
  const load=async()=>{
   try{
    const response=await fetch(RECRUITMENT_API+'/recruitment',{cache:'no-store',signal:controller.signal});
    if(!response.ok)throw new Error('unavailable');
    const result=await response.json();
    if(active){setRecruitment(['open','limited','closed'].includes(result.status)?result.status:null);setRecruitmentReason(result.reason||'');setRecruitmentReopens(result.reopens_on||null);setReopeningNote(result.reopening_note||'')}
   }catch{if(active){setRecruitment(null);setRecruitmentReason('');setRecruitmentReopens(null);setReopeningNote('')}}
  };
  void load();
  const onVisible=()=>{if(document.visibilityState==='visible')void load()};
  document.addEventListener('visibilitychange',onVisible);
  return()=>{active=false;controller.abort();document.removeEventListener('visibilitychange',onVisible)};
 },[]);
 useEffect(()=>{
  document.title='The Eclipse Order — A Final Fantasy XIV Roleplay Free Company';
  const handleEscape=e=>{if(e.key==='Escape'){setLetterOpen(false);setMenuOpen(false)}};
  window.addEventListener('keydown',handleEscape);
  return()=>window.removeEventListener('keydown',handleEscape);
 },[]);
 const closeMenu=()=>setMenuOpen(false);
 const recruitmentLabel=RECRUITMENT_LABELS[recruitment]||'RECRUITMENT STATUS UNAVAILABLE';
 const applicationsAccepted=recruitment==='open'||recruitment==='limited';
 return <div className="order-public">
  <a href="#content" className="public-skip">Skip to content</a>
  <header className="public-header">
   <a href="#home" className="public-brand" aria-label="The Eclipse Order home" onClick={closeMenu}><Mark/><span><strong>THE ECLIPSE ORDER</strong><small>NEW CASSIA · ILSABARD</small></span></a>
   <nav aria-label="Public site" className={'public-nav '+(menuOpen?'open':'')}>{NAV.map(([id,title])=><a key={id} href={'#'+id} onClick={closeMenu}>{title}</a>)}<a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" onClick={closeMenu}>Join Discord</a><a className="public-mobile-portal" href="?portal">Member sign-in</a></nav>
   <div className="public-header-actions"><a className={'public-recruitment-link public-recruitment-'+(recruitment||'unknown')} href="#membership"><span className="public-status-dot" aria-hidden="true"/> {recruitmentLabel}</a><a className="public-header-discord" href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer"><i className="fa-brands fa-discord" aria-hidden="true"/> Join Discord</a><a className="public-portal-link" href="?portal">Member sign-in</a>{applicationsAccepted&&<a className="public-top-cta" href="?portal">Request membership <span aria-hidden="true">↗</span></a>}</div>
   <button className="public-menu-toggle" type="button" onClick={()=>setMenuOpen(x=>!x)} aria-expanded={menuOpen} aria-label={menuOpen?'Close navigation':'Open navigation'}>{menuOpen?'✕':'☰'}</button>
  </header>
  <main id="content">
   <section className="public-hero" id="home">
    <div className="public-hero-geometry" aria-hidden="true">
     <div className="imperial-architecture"><span className="imperial-structure imperial-structure-left"/><span className="imperial-structure imperial-structure-center"/><span className="imperial-structure imperial-structure-right"/><span className="imperial-crown"/><span className="imperial-spire"/><span className="imperial-gate"/><span className="imperial-citadel-crest"><i className="fa-solid fa-chess-rook"/></span><span className="imperial-cityline"/></div>
     <span className="imperial-vertical-copy">ILSABARD · NEW CASSIA · THE ECLIPSE ORDER</span>
    </div>
    <div className="public-hero-content">
     <span className="public-kicker"><span className="public-kicker-line"/> NEW CASSIA · ILSABARD <span className="imperial-kicker-number">01 / THE ORDER</span></span>
     <h1>AN ORDER<br/><span className="imperial-headline-line">BUILDING AN <em>EMPIRE.</em></span></h1>
     <p className="public-hero-subtitle">From the ashes of Garlemald, the Eclipse Order rises with ambitions of its own. Under Domina Elira Sakurai, this imperial villain faction pursues territory, political authority, magitek strength, and an empire in New Cassia.</p>
     <div className="public-hero-cta"><a href="#about" className="public-button-primary">Discover the Order <span aria-hidden="true">↗</span></a><a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className="public-button-ghost"><i className="fa-brands fa-discord" aria-hidden="true"/> Join our Discord <span aria-hidden="true">↗</span></a><button type="button" className="public-button-ghost" onClick={()=>setLetterOpen(true)}>Read the invitation <span aria-hidden="true">◇</span></button></div>
     <div className="public-hero-bad-end"><span aria-hidden="true">◆</span> BAD END FC / 18+ / CONSEQUENCE-DRIVEN ROLEPLAY</div>
     <div className="public-hero-notes"><span>01 · IMPERIAL REMNANTS</span><span>02 · IMPERIAL ASCENDANCY</span><span>03 · NEW CASSIA</span></div>
     <div className="public-hero-location"><span>THE GOBLET · WARD 5 · PLOT 41</span><a href="#membership" className={'public-recruitment-'+(recruitment||'unknown')}><span className="public-status-dot" aria-hidden="true"/> {recruitmentLabel}</a></div>
    </div>
    <div className="public-scroll-cue" aria-hidden="true"><span>ENTER THE DOSSIER</span><i/></div>
   </section>
   <section className="public-section public-introduction" id="about">
    <div className="public-section-inner">
     <SectionTag number="01">THE ORDER</SectionTag>
     <div className="public-intro-grid"><div><h2>NO BANNERS.<br/><em>NO SAVIORS.</em></h2></div><div className="public-intro-copy"><p className="public-lead">The Eclipse Order is a Garlean-influenced imperial villain faction within Final Fantasy XIV. Beneath the Domina, its members pursue unity, authority, and power—even when their ambitions put them at odds with the realm.</p><p>Our roleplay is character-driven and continuous. The Order is a setting for intrigue, alliances, personal conflicts, dangerous expeditions, and the small moments that make a family out of people who never expected to belong anywhere.</p><a className="public-text-link" href="#roleplay">How our stories work <span aria-hidden="true">↗</span></a></div></div>
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
      <div><h2>AN ORDER<br/><em>BUILT IN SHADOW.</em></h2><p className="public-lead">The Order’s oldest traditions descend from Elira’s household on the Thirteenth. On the Source, those loyalties survived through informal household ties and later Garlean connections, shaping an imperial outlook rather than a criminal enterprise.</p><p>During Stormblood in Yanxia, the Eclipse Order fully took shape with formal ranks and organized branches. Earlier eras relied on household loyalty, not established Order ranks; Yanxia was the birthplace of its formal structure, not of Elira’s household.</p><p>The Final Days shattered much of the Order’s strength and forced it into dormancy. Its rebirth in New Cassia begins an independent imperial project of reconstruction, military expansion, diplomacy, and contested rule.</p><div className="public-history-quote">THE THIRTEENTH / GARLEMALD / YANXIA / NEW CASSIA</div></div>
     </div>
    </div>
   </section>
   <PublicChronicles/>
   <section className="public-section public-hierarchy" id="ranks">
    <div className="public-section-inner">
     <SectionTag number="04">THE ORDER OF THE SERPENT</SectionTag>
     <div className="public-section-heading"><div><h2>Many paths.<br/><em>One eclipse.</em></h2></div><p>The Order is not a single ladder. Its leadership, specialized branches, membership standing, and bonds of service are distinct.</p></div>
     <div className="public-command-tree">
      <div className="public-command-crest" aria-hidden="true"><i className="fa-solid fa-crown"/></div>
      <div className="public-command-line"/>
      <article><span>THE SOVEREIGN</span><h3>Domina</h3><p>At the center of the Order stands its supreme authority.</p></article>
      <article><span>SECOND IN COMMAND</span><h3>Grand Viper</h3><p>The Domina’s foremost deputy and the link between the throne and the Order’s command.</p></article>
      <article><span>THE INNER CIRCLE</span><h3>Inner Council</h3><p>The council offices guide the Order’s affairs beneath the Domina.</p></article>
     </div>
     <div className="public-branch-intro"><h3>Paths beneath the eclipse</h3><p>Each branch has its own progression, duties, and leadership.</p></div>
     <div className="public-branch-grid">{ORDER_BRANCHES.map(branch=><article className="public-branch-card" key={branch.name}><span className="public-branch-symbol" aria-hidden="true"><i className={"fa-solid "+branch.symbol}/></span><h3>{branch.name}</h3><p>{branch.summary}</p><div className="public-branch-tiers">{branch.ranks.map((name,index)=><div key={name}><small>{String(index+1).padStart(2,'0')}</small><span>{name}</span></div>)}</div></article>)}</div>
     <div className="public-other-standing">
      <article><span className="public-branch-kicker">MEMBERSHIP</span><h3>Freshscales <em>→</em> Voidscales</h3><p>The Order's membership standing is distinct from a character's branch duties.</p></article>
      <article><span className="public-branch-kicker">BONDS OF SERVICE</span><h3>The bound path</h3><p>Service has its own hierarchy. Standing within the Order does not automatically grant freedom from an in-character bond.</p><ol>{SERVITUDE_RANKS.map(name=><li key={name}>{name}</li>)}</ol></article>
     </div>
     <p className="public-footnote">In-character rank, membership standing, bonds of service, and out-of-character account permissions are separate.</p>
    </div>
   </section>
   <section className="public-section public-play" id="roleplay">
    <div className="public-section-inner">
     <SectionTag number="05">HOW WE ROLEPLAY</SectionTag>
     <div className="public-section-heading"><div><h2>A world beyond<br/><em>the character sheet.</em></h2></div><p>Roleplay happens in-game. Our companion portal gives the shared story a place to keep its characters, assignments, and encounters together.</p></div>
     <div className="public-play-stage">
      <div className="public-play-tabs" role="tablist" aria-label="Roleplay experiences">{MODES.map((item,i)=><button role="tab" id={'mode-tab-'+i} aria-controls="mode-panel" aria-selected={mode===i} type="button" className={mode===i?'active':''} key={item.name} onClick={()=>setMode(i)}><span>{item.mark}</span>{item.name}</button>)}</div>
      <div className="public-play-content" role="tabpanel" id="mode-panel" aria-labelledby={'mode-tab-'+mode}><div><span className="public-play-eyebrow">{MODES[mode].mark} / THE EXPERIENCE</span><h3>{MODES[mode].heading}</h3><p>{MODES[mode].body}</p><a className="public-text-link" href="?portal">Explore the member portal <span aria-hidden="true">↗</span></a></div><div className={'public-play-symbol public-play-symbol-'+mode} aria-hidden="true"><i className={'fa-solid fa-'+(mode===0?'book-open':mode===1?'calendar-days':'dice-d20')}/></div></div>
     </div>
     <div className="public-play-details">
      <article><span>01</span><h3>Character dossiers</h3><p>Keep your character’s identity, class, abilities, and progress in one place.</p></article>
      <article><span>02</span><h3>Event chapters</h3><p>Join story events, including FC MSQ arcs that move the Order’s main narrative forward.</p></article>
      <article><span>03</span><h3>Dice & encounters</h3><p>Settle uncertain outcomes with custom dice rules, initiative, and a tactical battle map.</p></article>
     </div>
    </div>
   </section>
   <section className="public-section public-activities" id="activities" aria-labelledby="public-activities-heading">
    <div className="public-section-inner">
     <SectionTag number="05 / FIELD OPERATIONS">LIFE WITHIN THE ORDER</SectionTag>
     <div className="public-section-heading"><div><h2 id="public-activities-heading">More than a title.<br/><em>A world to take part in.</em></h2></div><p>From campaigns in the field to quiet deals behind closed doors, Eclipse Order events give members different ways to shape our shared story.</p></div>
     <div className="public-activities-grid">{FC_ACTIVITIES.map(activity=><article className="public-activity-card" key={activity.title}><div className="public-activity-top"><span className="public-activity-symbol" aria-hidden="true"><i className={'fa-solid '+activity.icon}/></span><span className="public-activity-category">FC EVENTS</span></div><h3>{activity.title}</h3><strong>{activity.subtitle}</strong><p>{activity.description}</p></article>)}</div>
     <div className="public-activities-after"><div><h3>Your character matters beyond events.</h3><p>Character-led roleplay, expeditions, intrigue, trade, crafting, and the Order’s ongoing story connect what happens between major events. Not every member needs to be a fighter to have a place here.</p><small>Event dates and participation details are shared through our community channels; no fixed schedule is promised here.</small></div><a className="public-button-primary" href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer"><i className="fa-brands fa-discord" aria-hidden="true"/> Join our community <span aria-hidden="true">↗</span></a></div>
    </div>
   </section>
   <section className="public-section public-bad-end" id="bad-end">
    <div className="public-section-inner">
     <SectionTag number="06">THE NATURE OF THE ORDER</SectionTag>
     <div className="public-bad-end-layout">
      <div><div className="public-bad-end-label"><span aria-hidden="true">✦</span> ADULT ROLEPLAY · BAD END FC</div><h2>Not every story<br/><em>ends in freedom.</em></h2><p className="public-lead">The Eclipse Order is a Bad End-focused Free Company. This is a core part of our storytelling, not a hidden twist.</p></div>
      <div className="public-bad-end-explanation">
       <h3>What a Bad End means here</h3>
       <p>Characters can lose power, freedom, status, and even their lives. Captivity, servitude, coercion, betrayal, and permanent consequences can be part of the in-character world. Being defeated may shape a character’s future rather than return them to the way things were.</p>
       <p>Our stories take those outcomes seriously: some character arcs have no easy escape, and an in-character departure may carry severe consequences. This is a darker, high-stakes environment, not a conventional heroic adventure.</p>
       <h3>The player always has a choice</h3>
       <p>Bad ends apply to fictional characters, never the player behind them. No one is required to accept unwanted scenes, and out-of-character safety, consent, and boundaries take priority. If someone needs to step away, Order command can discuss an appropriate story exit.</p>
       <div className="public-bad-end-highlights"><span>18+ COMMUNITY</span><span>CHARACTER CONSEQUENCES</span><span>PLAYER CONSENT</span></div>
      </div>
     </div>
    </div>
   </section>
   <section className="public-section public-conduct" id="conduct">
    <div className="public-section-inner">
     <SectionTag number="07">BEYOND THE MASK</SectionTag>
     <div className="public-conduct-grid"><div><h2>Dark stories.<br/><em>Clear boundaries.</em></h2></div><div><p className="public-lead">The Order can be ruthless in-character. Our community should never be.</p><p>Character conflict is not player conflict. We expect members to respect consent, keep in-character and out-of-character matters separate, and collaborate before imposing lasting consequences on another person’s character.</p><p>The strongest stories are possible when everyone involved knows where their boundaries lie.</p><div className="public-conduct-principles"><span>CONSENT</span><span>RESPECT</span><span>COMMUNICATION</span></div></div></div>
    </div>
   </section>
   <section className="public-section public-visit" id="visit">
    <div className="public-section-inner">
     <SectionTag number="08">FIND THE ORDER</SectionTag>
     <div className="public-visit-grid">
      <div className="public-visit-story"><h2>From Ilsabard.<br/><em>Into the shadows.</em></h2><p className="public-lead">New Cassia in Ilsabard is the Order’s renewed seat of power and the center of its growing ambitions.</p><p>Here, imperial loyalists, rival governments, contested settlements, and uneasy allies shape new stories. Our Eorzean estate remains the place to meet us in Final Fantasy XIV; New Cassia is part of our roleplay setting.</p>
       <a href="?lore" className="public-text-link">Explore the Order’s chronicles <span aria-hidden="true">↗</span></a>
       <div className="public-visit-mountain"><span aria-hidden="true">⌁</span><div><strong>NEW CASSIA · ILSABARD</strong><small>THE ORDER’S IN-CHARACTER HOME</small></div></div>
      </div>
      <aside className="public-estate-card" aria-label="The Eclipse Order in-game estate address">
       <span className="public-estate-corner top-left" aria-hidden="true"/><span className="public-estate-corner top-right" aria-hidden="true"/><span className="public-estate-corner bottom-left" aria-hidden="true"/><span className="public-estate-corner bottom-right" aria-hidden="true"/>
       <div className="public-estate-eyebrow">THE ORDER · IN THE REALM</div>
       {ESTATE.map(([label,value])=><div className="public-estate-field" key={label}><small>{label}</small><strong>{value}</strong></div>)}
       <div className={'public-estate-note public-recruitment-'+(recruitment||'unknown')}><span className="public-status-dot" aria-hidden="true"/> {recruitmentLabel}</div>
       <button className="public-copy-address" type="button" onClick={async()=>{try{await navigator.clipboard.writeText('Dynamis · Seraph · The Goblet · Ward 5 · Plot 41');setAddressCopied(true)}catch{setAddressCopied(false)}}}>{addressCopied?'Address copied ✓':'Copy estate address'} <span aria-hidden="true">↗</span></button>
      </aside>
     </div>
    </div>
   </section>
   <section className="public-section public-recruit-fit" id="who-fits" aria-labelledby="public-fit-heading">
    <div className="public-section-inner">
     <SectionTag number="09">WHO WE'RE LOOKING FOR</SectionTag>
     <h2 id="public-fit-heading" className="public-fit-title">The kind of company <em>we keep.</em></h2>
     <div className="public-fit-grid">
      <article className="public-fit-card public-fit-welcome">
       <h3><span className="public-fit-symbol" aria-hidden="true"><i className="fa-solid fa-check"/></span>You'll fit here if —</h3>
       <ul>
        <li>You enjoy playing <strong>Garleans</strong>, former imperial officers, defectors, or people still loyal to a fallen cause.</li>
        <li>Your character belongs among <strong>imperial officers, spies, magitek researchers, diplomats, soldiers, or ambitious civilians.</strong></li>
        <li>You prefer schemes, intrigue, and hard bargains over being the hero who saves the realm.</li>
        <li>You like stories where choices have consequences, loyalties can fracture, and not every ending is happy.</li>
        <li>You want to build a character with a history and ambitions of their own, not borrow the spotlight from FFXIV's main cast.</li>
        <li>You're new to roleplay or have years behind you. Both are welcome if you're ready to build stories together.</li>
       </ul>
      </article>
      <article className="public-fit-card public-fit-not-for">
       <h3><span className="public-fit-symbol" aria-hidden="true"><i className="fa-solid fa-xmark"/></span>You probably won't fit if —</h3>
       <ul>
        <li>You're looking for a <strong>heroic Free Company</strong> devoted to saving the realm and defeating every villain.</li>
        <li>You want your character to be the <strong>Warrior of Light</strong>, a main-story hero, or the center of everyone else's story.</li>
        <li>You expect your character to win every confrontation or escape every consequence.</li>
        <li>You want a nightclub or venue-first group rather than an ongoing imperial campaign and character-driven storyline.</li>
        <li>You don't enjoy darker themes, morally compromised characters, or collaborative storytelling with real stakes.</li>
       </ul>
      </article>
     </div>
     <aside className="public-fit-lore">
      <p><strong>ON CHARACTERS AND LORE.</strong> We bend lore; we don't break it. Original Garlean characters, imperial loyalists, former enemies, and morally complex outsiders are welcome. Bring your own story, not the realm's main cast. The Order is an antagonist faction, but individual members may have sincere ideals and conflicting loyalties; it is not a home for would-be saviors.</p>
     </aside>
     <div className="public-fit-invitation"><p>Sound like your sort of trouble?</p><a href="#membership" className="public-text-link">Find your place in the Order <span aria-hidden="true">↗</span></a></div>
    </div>
   </section>
   <section className="public-section public-membership" id="membership">
    <div className="public-section-inner">
     <SectionTag number="10">{recruitment==='closed'?'THE DOOR IS CLOSED':recruitment==='limited'?'AN INVITATION BY CONSIDERATION':'THE DOOR IS OPEN'}</SectionTag>
     <div className="public-membership-grid"><div><h2>Every oath begins<br/><em>with a choice.</em></h2><p>Whether you arrive as an ambitious operative, a quiet specialist, or someone with nowhere else left to go, the story begins when you decide to knock.</p>{applicationsAccepted?<a className="public-button-primary" href="?portal">Request membership <span aria-hidden="true">↗</span></a>:<span className="public-membership-closed">{recruitment==='closed'?'The Order is not accepting new members at present.':'Recruitment status is temporarily unavailable.'}</span>}{recruitment==='closed'&&<div className="public-recruitment-announcement" role="status"><strong>Notice from the Order</strong><p>{recruitmentReason||'Recruitment is presently closed.'}</p>{reopeningNote&&<p className="public-reopening-date">{reopeningNote}</p>}{recruitmentReopens&&<p className="public-reopening-date"><span>Anticipated reopening</span> <time dateTime={recruitmentReopens}>{new Date(recruitmentReopens+'T12:00:00').toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'})}</time></p>}</div>}<span className="public-membership-note">{recruitment==='closed'?'Existing members may continue to enter through the member portal.':recruitment==='limited'?'The Order is considering applications selectively. Discord membership and approval by Order command are required.':'Discord server membership and approval by Order command are both required before portal access is granted.'}</span></div>
      <div className="public-membership-steps"><a className="public-membership-discord" href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer"><i className="fa-brands fa-discord" aria-hidden="true"/> Join the community Discord <span aria-hidden="true">↗</span></a>{[{title:'Introduce yourself',text:'Authorize Discord and, if needed, request to join the server.'},{title:'Meet the Order',text:'Order command reviews your Discord-linked membership and the Bad End RP expectations.'},{title:'Begin your story',text:'Once approved, build your character dossier and explore the Order’s events.'}].map((step,i)=><div className="public-membership-step" key={step.title}><span>0{i+1}</span><div><h3>{step.title}</h3><p>{step.text}</p></div></div>)}</div>
     </div>
    </div>
   </section>
   <section className="public-section public-faq" id="questions">
    <div className="public-section-inner">
     <SectionTag number="11">QUESTIONS BEFORE THE OATH</SectionTag>
     <div className="public-section-heading"><h2>What would you<br/><em>like to know?</em></h2><p>An invitation should come with a few answers.</p></div>
     <div className="public-faq-list">
      {faqEntries.map(entry=><div key={entry.id} className={'public-faq-item '+(expandedFAQ===entry.id?'open':'')}><button type="button" aria-expanded={expandedFAQ===entry.id} onClick={()=>setExpandedFAQ(expandedFAQ===entry.id?null:entry.id)}><span>{entry.question}</span><span aria-hidden="true">{expandedFAQ===entry.id?'−':'+'}</span></button>{expandedFAQ===entry.id&&<p>{entry.answer}</p>}</div>)}
      {faqStatus==='unavailable'&&<p className="public-faq-message">The Order's answers are temporarily unavailable.</p>}
      {faqStatus==='loading'&&<p className="public-faq-message">Opening the Order's answers…</p>}
      {faqStatus==='ready'&&!faqEntries.length&&<p className="public-faq-message">No public questions have been published yet.</p>}
     </div>
    </div>
   </section>
   <footer className="public-footer"><div className="public-footer-upper"><div><Mark/><h2>The Eclipse Order</h2><p>Under the eclipse, our stories endure.</p></div><div><span>EXPLORE</span><a href="#about">The Order</a><a href="#history">Our History</a><a href="#ranks">Hierarchy</a><a href="#roleplay">Roleplay</a><a href="#activities">FC Activities</a><a href="#bad-end">Bad End RP</a><a href="#visit">Visit Us</a><a href="#who-fits">Who Fits In</a><a href="#chronicles">Chronicles</a></div><div><span>ENTER</span><a href="#membership">Membership</a><a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">Join Discord</a><a href="?portal">Member sign-in</a><a href="#questions">Questions</a></div></div><div className="public-footer-lower"><span>© {new Date().getFullYear()} The Eclipse Order</span><span>A Final Fantasy XIV roleplay community. FINAL FANTASY XIV © SQUARE ENIX. Not affiliated with Square Enix.</span><a href="#home">Back to the top ↑</a></div></footer>
  </main>
  {letterOpen&&<div className="public-letter-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setLetterOpen(false)}}><div className="public-letter" role="dialog" aria-modal="true" aria-labelledby="invitation-title"><button type="button" aria-label="Close invitation" className="public-letter-close" onClick={()=>setLetterOpen(false)}>✕</button><Mark/><span className="public-letter-kicker">A LETTER WITHOUT A SIGNATURE</span><h2 id="invitation-title">To the one who found this.</h2><p>Rumors have a way of reaching the people they are meant for. Perhaps you followed one here. Perhaps you had nowhere else to turn. The Order does not care how the first thread came into your hands.</p><p>What matters is what you do with it.</p><p>There is a place for those who understand the cost of loyalty, and for those willing to learn. But understand this: nothing worth carrying comes without weight.</p><p className="public-letter-signoff">— Beneath the Eclipse</p><button type="button" className="public-button-primary" onClick={()=>{setLetterOpen(false);document.querySelector('#about')?.scrollIntoView({behavior:'smooth'})}}>Read the Order’s story <span aria-hidden="true">↗</span></button></div></div>}
 </div>;
}
