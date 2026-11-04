import React from 'react';
import './order-sheets.css';

export const ACCOUNT_ROLES = {
  domina:{label:'Domina',description:'Supreme Order command; all records, member roles and assignments'},
  high_command:{label:'High Command',description:'Full roster and administrative character control'},
  handler:{label:'Master / Mistress',description:'Full access only to assigned characters'},
  member:{label:'Member',description:'Their own unbound character sheets, or collar-limited views'}
};
const ABILITIES = [
  ['str','Strength'],['dex','Dexterity'],['con','Constitution'],
  ['int','Intelligence'],['wis','Wisdom'],['cha','Charisma']
];
const SKILLS = [
  ['Acrobatics','dex'],['Animal Handling','wis'],['Arcana','int'],
  ['Athletics','str'],['Deception','cha'],['History','int'],
  ['Insight','wis'],['Intimidation','cha'],['Investigation','int'],
  ['Medicine','wis'],['Nature','int'],['Perception','wis'],
  ['Performance','cha'],['Persuasion','cha'],['Religion','int'],
  ['Sleight of Hand','dex'],['Stealth','dex'],['Survival','wis']
];
const mod = n => Math.floor((Number(n||10)-10)/2);
const signed = n => (n>=0?'+':'')+n;
export function LimitedSheet({character}){
  return <section className="panel bound-sheet">
    <div className="bound-heading"><div className="bound-emblem">◇</div><div><div className="eyebrow">ARCANE COLLAR · BOUND RECORD</div><h2>{character.name}</h2><p>{character.rank}</p></div></div>
    <p className="bound-intro">Your character is under a magical binding. The Order's system displays only the details the collar allows you to perceive. This is a roleplay restriction on the fictional character sheet.</p>
    <div className="limited-grid">
      <div><small>CHARACTER</small><strong>{character.name}</strong></div>
      <div><small>ROLE</small><strong>{character.specialty||'Unassigned'}</strong></div>
      <div><small>ASSIGNED HANDLER</small><strong>{character.owner||'Unassigned'}</strong></div>
      <div><small>COLLAR STATUS</small><strong>Binding active</strong></div>
      <div><small>VISIBLE CONDITION</small><strong>{character.hp ?? 'Unknown'} HP</strong></div>
    </div>
    <div className="sealed"><span className="sealed-symbol">✦</span><div><h3>Arcane seals are active</h3><p>Ability scores, saving throws, skills, spells, possessions, class features, and private notes are sealed from this character's view. Authorized staff can still maintain the complete D&D sheet.</p></div></div>
  </section>;
}
function TextSection({label,value}){
  return <div className="sheet-section"><h3>{label}</h3><div className="sheet-text">{value || 'Nothing recorded yet.'}</div></div>;
}
export function FullDndSheet({character}){
  const proficiency=Number(character.proficiency_bonus || Math.min(6,2+Math.floor(((Number(character.level)||1)-1)/4)));
  const skills=character.skills && typeof character.skills==='object' && !Array.isArray(character.skills) ? character.skills : {};
  const saves=character.saving_throws && typeof character.saving_throws==='object' && !Array.isArray(character.saving_throws) ? character.saving_throws : {};
  return <div className="full-dnd">
    <div className="full-banner"><span>COMPLETE CHARACTER DOSSIER</span><strong>{character.collar_bound?'Restricted for assigned player':'Unbound character'}</strong></div>
    <div className="sheet-metadata">
      {[
        ['Class',character.class_name],['Level',character.level],['Species',character.species],
        ['Background',character.background],['Alignment',character.alignment],['XP',character.experience]
      ].map(([label,value])=><div key={label}><small>{label.toUpperCase()}</small><strong>{value || '—'}</strong></div>)}
    </div>
    <div className="combat-stats">
      {[
        ['Armor Class',character.armor_class ?? 10],['Initiative',signed(mod(character.dex))],
        ['Speed',(character.speed ?? 30)+' ft'],['Proficiency',signed(proficiency)],
        ['Hit Points',(character.hp ?? 20)+' / '+(character.max_hp ?? character.hp ?? 20)],
        ['Temp HP',character.temp_hp ?? 0],['Hit Dice',character.hit_dice || '—']
      ].map(([label,value])=><div key={label}><small>{label}</small><strong>{value}</strong></div>)}
    </div>
    <div className="full-grid">
      <section className="panel"><h2>Ability scores & saving throws</h2>
        <div className="dnd-ability-grid">{ABILITIES.map(([key,label])=><div className="ability-card" key={key}>
          <small>{label}</small><strong>{character[key]??10}</strong><span>{signed(mod(character[key]))}</span>
          <p>Save {signed(mod(character[key])+(saves[key]?proficiency:0))}{saves[key]?' · proficient':''}</p>
        </div>)}</div>
      </section>
      <section className="panel"><h2>Skills & proficiencies</h2><div className="skills-grid">{SKILLS.map(([name,key])=><div className="skill" key={name}><span>{name}</span><strong>{signed(mod(character[key])+(skills[name]?proficiency:0))}</strong></div>)}</div></section>
    </div>
    <div className="full-grid">
      <section className="panel"><TextSection label="Features & traits" value={character.features}/><TextSection label="Proficiencies & languages" value={character.proficiencies}/><TextSection label="Conditions" value={character.conditions}/></section>
      <section className="panel"><TextSection label="Spells & magic" value={character.spells}/><TextSection label="Equipment & inventory" value={character.inventory}/></section>
    </div>
    <section className="panel"><h2>Personality & character history</h2><div className="full-grid personality-grid">
      <TextSection label="Personality traits" value={character.personality}/><TextSection label="Ideals" value={character.ideals}/>
      <TextSection label="Bonds" value={character.bonds}/><TextSection label="Flaws" value={character.flaws}/>
    </div></section>
  </div>;
}
export function MemberDirectory({members,currentRole,onChangeRole}){
  return <section className="panel"><div className="panel-heading"><div><h2>Order membership & command hierarchy</h2><p>Roles control what each authenticated account can access.</p></div></div>
    <div className="hierarchy-grid">{Object.entries(ACCOUNT_ROLES).map(([key,item])=><div className={'hierarchy-card hierarchy-'+key} key={key}><strong>{item.label}</strong><p>{item.description}</p><span>{members.filter(m=>m.role===key).length} account(s)</span></div>)}</div>
    <div className="table-scroll"><table><thead><tr><th>MEMBER ACCOUNT</th><th>ROLE</th><th>CHANGE PERMISSIONS</th></tr></thead><tbody>{members.map(m=><tr key={m.user_id}><td>{m.email}</td><td>{ACCOUNT_ROLES[m.role]?.label||m.role}</td><td><select aria-label={'Assign role for '+m.email} value={m.role} disabled={!['domina','high_command'].includes(currentRole) || (currentRole==='high_command'&&['domina','high_command'].includes(m.role))}
      onChange={e=>onChangeRole(m,e.target.value)}>
      {Object.entries(ACCOUNT_ROLES).filter(([key])=>currentRole==='domina'||(!['domina','high_command'].includes(key))).map(([key,value])=><option value={key} key={key}>{value.label}</option>)}
      </select></td></tr>)}</tbody></table></div>
    <div className="hint-box"><strong>Account creation</strong><p>Create member accounts in Supabase Authentication → Users, then approve each account in order_members. This screen changes approved account roles; it never stores or handles member passwords.</p></div>
  </section>;
}
