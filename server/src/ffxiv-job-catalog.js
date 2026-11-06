// FFXIV-inspired tabletop interpretations for the Eclipse Order.
// Job names and combat archetypes reflect FFXIV; ability effects and 1–20 pacing
// are original lightweight adaptations, not copied level-100 action text.
// The six retired starter templates remain available for existing characters.
const LEVELS=[1,3,5,7,10,13,16,20];
const SPELL_LEVELS=[1,3,5,7,10,13,16,20];
// Each job supplies its own identity and eight progressively stronger techniques.
const JOBS=[
 // Tanks
 ['paladin','Paladin','tank','str','str,cha',10,'half','Oathbound shield bearer who protects allies.',
  'Oathguard|Shield Intercept|Cleansing Blade|Circle of Shelter|Aegis Counter|Sacred March|Judgment of Light|Unbroken Oath',
  'Radiant Strike|Mending Prayer|Ward of Valor|Sanctified Ground|Blinding Crest|Shared Aegis|Lasting Sanctuary|Crown of Light'],
 ['warrior-job','Warrior','tank','str','str,con',12,'none','Fierce axe wielder who turns momentum into endurance.',
  'Berserker Focus|Blood Surge|Sweeping Cleave|Iron Tempest|Defiant Roar|Unshaken|Earthshaker|Primal Fury',''],
 ['dark-knight','Dark Knight','tank','str','str,cha',10,'half','Greatsword guardian wielding shadow against oppression.',
  'Shadow Vow|Dark Ward|Vengeful Slash|Living Barrier|Umbral Counter|Nightfall|Soul Fortress|Abyssal Sentinel',
  'Dusk Edge|Black Veil|Sable Chain|Warden of Night|Shadow Step|Blackened Earth|Oath of Ruin|Last Eclipse'],
 ['gunbreaker','Gunbreaker','tank','dex','dex,con',10,'none','Gunblade defender using burst techniques and timely guards.',
  'Cartridge Training|Keen Guard|Burst Sequence|Covering Fire|Aurora Field|Explosive Counter|Relentless Combo|Heart of the Gunblade',''],
 // Healers
 ['white-mage','White Mage','healer','wis','wis,cha',8,'full','Restorative conjurer attuned to nature and light.',
  'Flow of Aether|Gentle Focus|Cleansing Prayer|Benediction Circle|Lily Reserve|Radiant Shelter|Sacred Bloom|Miracle of Renewal',
  'Cure|Stoneburst|Regen|Esuna|Medica|Holy Ward|Asylum|Benediction'],
 ['scholar','Scholar','healer','int','int,wis',8,'full','Tactical healer using a faerie companion and wards.',
  'Faerie Bond|Tactical Insight|Shield Calculus|Aetherflow|Chain Tactics|Emergency Succor|Seraphic Formation|Grand Stratagem',
  'Adloquium|Faerie Mend|Succor|Dispel|Aether Shield|Faerie Blessing|Expedient|Seraphic Concord'],
 ['astrologian','Astrologian','healer','wis','wis,cha',8,'full','Celestial healer using fortunes and supporting cards.',
  'Star Chart|Card Draw|Minor Arcana|Fated Alignment|Stellar Reserve|Lunar Balance|Celestial Path|Grand Divination',
  'Benefic|Stellar Bolt|Aspected Ward|Lunar Mend|Collective Shield|Earthly Star|Horoscope|Astral Destiny'],
 ['sage','Sage','healer','int','int,wis',8,'full','Noulith healer applying barriers and offensive restoration.',
  'Kardia Link|Barrier Study|Adder Reserve|Icarus Shift|Panhaima Matrix|Eukrasian Edge|Holos Field|Noumenon',
  'Dosis|Diagnosis|Prognosis|Eukrasian Shield|Phlegma|Kerachole|Pneuma|Eudaimonia'],
 // Melee
 ['monk','Monk','melee','dex','dex,wis',10,'none','Disciplined martial artist channeling body and spirit.',
  'Disciplined Fist|Flowing Form|Pressure Point|Chakra Breath|Wind Step|Perfect Balance|Thunderous Strike|Sixfold Mastery',''],
 ['dragoon','Dragoon','melee','str','str,dex',10,'none','Lancer specializing in aerial dives and dragon-inspired strikes.',
  'Lance Discipline|Leaping Strike|Dragon Sight|Skydive|Piercing Momentum|Drakesbane|Stardive|Celestial Descent',''],
 ['ninja','Ninja','melee','dex','dex,int',8,'half','Stealth specialist combining blades and quick ninjutsu.',
  'Hidden Blade|Mudra Study|Smoke Step|Fanged Ambush|Shadow Double|Trick Assault|Secret Art|Master of the Veil',
  'Shuriken|Ember Mudra|Gale Mudra|Frost Mudra|Lightning Sigil|Shadow Bind|Mirror Clone|Final Ninjutsu'],
 ['samurai','Samurai','melee','dex','dex,wis',10,'none','Katana duelist building precise momentum toward finishers.',
  'Sword Saint Stance|Sen Form|Focused Draw|Iaijutsu|Third Eye|Mooncut|Flawless Riposte|Final Blossom',''],
 ['reaper','Reaper','melee','str','str,cha',10,'half','Scythe combatant channeling a bound void avatar.',
  'Avatar Pact|Reaping Cut|Soul Harvest|Voidward|Enshroud|Soul Rend|Grim Communion|Deathly Crescendo',
  'Void Slash|Spectral Grip|Soul Drain|Shadow Harvest|Ebon Ward|Phantom Step|Void Scythe|Avatar Ascendant'],
 ['viper','Viper','melee','dex','dex,str',8,'none','Twin-blade duelist weaving rapid strikes into serpent combos.',
  'Twin Fangs|Serpent Rhythm|Coiled Strike|Hunter’s Pivot|Twinblade Fusion|Venomous Reversal|Reawaken|Ouroboros Finale',''],
 // Physical ranged
 ['bard-job','Bard','ranged','dex','dex,cha',8,'half','Archer and performer who rallies the party with songs.',
  'Archer’s Tempo|Ballad Training|Battle Refrain|Quick Nock|Wanderer’s Verse|Heroic Crescendo|Radiant Arrow|Song of Legends',
  'Healing Verse|Rousing Ballad|Silencing Arrow|Warding Hymn|Echoing Song|March of Courage|Rain of Notes|Grand Finale'],
 ['machinist','Machinist','ranged','dex','dex,int',8,'none','Firearm specialist using gadgets, turrets and burst fire.',
  'Aetherfirearm|Quick Reload|Deploy Turret|Heated Round|Rook Support|Drill Burst|Automaton Queen|Overclock Barrage',''],
 ['dancer','Dancer','ranged','dex','dex,cha',8,'half','Throwing-weapon performer coordinating partners and rhythm.',
  'Dance Partner|Flowing Step|Fan Dance|Supportive Flourish|En Avant|Technical Rhythm|Saber Dance|Last Waltz',
  'Mending Dance|Wind Fan|Guarding Step|Soothing Waltz|Aether Flourish|Dancing Lights|Grand Step|Final Performance'],
 // Magical ranged
 ['black-mage','Black Mage','caster','int','int,wis',6,'full','Elemental mage alternating destructive fire and restorative ice.',
  'Astral Focus|Umbral Recovery|Elemental Balance|Flare Reserve|Ley Lines|Deep Freeze|Triple Focus|Astral Paradox',
  'Fire|Blizzard|Thunder|Sleep|Firestorm|Ice Barrier|Flare|Meteoric Surge'],
 ['summoner','Summoner','caster','int','int,cha',6,'full','Primal-inspired mage calling temporary eidolic manifestations.',
  'Aether Summons|Ruby Attunement|Topaz Guard|Emerald Swiftness|Trance|Eidolon Bond|Grand Invocation|Primal Convergence',
  'Ruin|Carbuncle Ward|Ruby Burst|Topaz Aegis|Emerald Gale|Dreadwyrm Breath|Phoenix Fire|Eidolon Finale'],
 ['red-mage','Red Mage','caster','int','dex,int',8,'full','Rapier spellcaster balancing elemental magic and swift melee.',
  'Dualcast|Balanced Aether|Enchanted Riposte|Swift Remedy|Corps-à-corps|Manaflare|Verholy and Verflare|Perfect Duality',
  'Jolt|Veraero|Verthunder|Vercure|Verfire|Verstone|Verraise|Scorch'],
 ['pictomancer','Pictomancer','caster','int','int,cha',6,'full','Brush-wielding mage painting motifs into temporary reality.',
  'Living Canvas|Color Palette|Creature Motif|Paint Reserve|Hammer Motif|Landscape Muse|Starry Canvas|Masterpiece',
  'Red Pigment|Green Gust|Blue Torrent|Painted Shield|Sketch Beast|White Splash|Chromatic Comet|Star Prism'],
 // Evercold (8.0) — simplified to the same eight milestones as earlier jobs.
 // Bastion: main tank with paired skyltborg greatshields and aetherial artillery.
 ['bastion','Bastion','tank','str','str,con',12,'half','Main tank wielding twin skyltborg greatshields that intercept blows and fire aetherial bursts.',
  'Twin Skyltborg Discipline|Interlocking Guard|Aether Cannon|Shieldwall Advance|Retaliatory Volley|Fortress Stance|Skyltborg Barrage|Unyielding Bastion',
  'Shield Pulse|Aether Guard|Bulwark Cannon|Linked Aegis|Repelling Burst|Fortress Ward|Skyltborg Nova|Last Rampart'],
 // Zephyr: physical ranged crossbow hunter aided by an avian familiar.
 ['zephyr','Zephyr','ranged','dex','dex,wis',8,'half','Physical ranged DPS using precision crossbow shots and coordinated attacks with an avian familiar.',
  'Crossbow Discipline|Nephele Companion|Winged Mark|Raking Volley|Featherstep|Familiar Coordination|Skyhunter Barrage|Tempest Hunt',
  'Guided Bolt|Wing Ward|Aerial Scout|Gale Shot|Nephele Dive|Pinning Bolt|Stormwing Salvo|Horizon Strike']
];
const DESCRIPTIONS={
 tank:'Intercept an attack or hold the line, using normal GM-adjudicated dice checks.',
 healer:'Heal, mitigate or cleanse with an action and the encounter healing dice.',
 melee:'Make a close-range attack or maneuver, using normal encounter dice.',
 ranged:'Make a ranged attack or support maneuver, using normal encounter dice.',
 caster:'Resolve a magical attack or effect using the encounter dice and GM adjudication.'
};
const spellEffect=(name,role,level)=>{
 const special=/cure|mend|benefic|regen|succor|diagnos|prognos|heal|blessing|medica|verse|ward|shield|aegis|guard|sanctuary|asylum|kerachole|kardia|pact|accord|protect|barrier/i.test(name);
 return special?
  'Defensive or restorative technique: spend spell points, then roll healing or protection dice as approved by the GM.':
  role==='melee'||role==='ranged'?'Imbue an attack or support move with aether; resolve with a normal attack or saving throw.':
  'Spend spell points to invoke an elemental, arcane, or supportive effect; resolve with normal encounter dice and GM adjudication.';
};
function slug(s){return s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g,'').trim().replace(/\s+/g,'-')}
export const FFXIV_JOB_COUNT=JOBS.length;
export function ffxivJobCatalog(){
 return Object.fromEntries(JOBS.map(([id,name,role,primary,saves,hit_die,casting,description,features,spells])=>{
  const featureList=features.split('|');
  const spellList=spells?spells.split('|'):[];
  return [id,{
   id,name,description:description+' Adapted as a 20-level tabletop '+role+' job.',
   hit_die,primary,saves:saves.split(','),casting,
   features:featureList.map((title,i)=>({
    level:LEVELS[i],name:title,
    description:DESCRIPTIONS[role]+' At level '+LEVELS[i]+', this technique becomes available.'
   })),
   spells:spellList.map((title,i)=>({
    id:slug(title),name:title,level:SPELL_LEVELS[i],
    cost:Math.min(8,1+i),
    description:spellEffect(title,role,SPELL_LEVELS[i])
   })),
   built_in:true,job_role:role,origin:'ffxiv_tabletop'
  }];
 }));
}
