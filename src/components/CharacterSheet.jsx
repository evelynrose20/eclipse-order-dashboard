import React, { useState } from 'react';
import { RANKS } from '../data/initialData';
import DiceRoller from './DiceRoller';

export default function CharacterSheet({ slaves, currentUser, onAddSlave }) {
  const [selectedId, setSelectedId] = useState(slaves[0]?.id || 1);
  const [showNewForm, setShowNewForm] = useState(false);

  // New character form state
  const [newName, setNewName] = useState('');
  const [newSpecialty, setNewSpecialty] = useState('');
  const [newOwner, setNewOwner] = useState('');
  const [str, setStr] = useState(10);
  const [dex, setDex] = useState(10);
  const [con, setCon] = useState(10);
  const [int, setInt] = useState(10);
  const [wis, setWis] = useState(10);
  const [cha, setCha] = useState(10);

  const currentSlave = slaves.find(s => s.id === Number(selectedId)) || slaves[0];
  const rankInfo = currentSlave ? RANKS[currentSlave.rank] : RANKS["Rank I: Unbroken"];

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const newChar = {
      id: Date.now(),
      name: newName,
      player: `@${currentUser}`,
      owner: newOwner || 'Unassigned',
      rank: 'Rank I: Unbroken',
      specialty: newSpecialty || 'General Labour',
      str: Number(str),
      dex: Number(dex),
      con: Number(con),
      int: Number(int),
      wis: Number(wis),
      cha: Number(cha),
      hp: 20 + (Number(con) - 10),
      gil: 0,
      notes: 'Newly registered sheet.'
    };

    onAddSlave(newChar);
    setSelectedId(newChar.id);
    setShowNewForm(false);
    setNewName('');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h2>Character Sheet & Roster</h2>
        <div>
          <select 
            value={selectedId} 
            onChange={(e) => { setSelectedId(e.target.value); setShowNewForm(false); }}
            style={{ background: '#2a2a2a', color: '#fff', padding: '8px', borderRadius: '4px', marginRight: '10px' }}
          >
            {slaves.map(s => <option key={s.id} value={s.id}>{s.name} ({s.specialty})</option>)}
          </select>
          <button 
            onClick={() => setShowNewForm(!showNewForm)} 
            style={{ background: '#8b0000', color: '#fff', border: 'none', padding: '8px 14px', cursor: 'pointer', borderRadius: '4px' }}
          >
            {showNewForm ? 'Cancel' : '+ Create New Sheet'}
          </button>
        </div>
      </div>

      {showNewForm ? (
        <div style={{ background: '#1e1e1e', padding: '20px', borderRadius: '8px', border: '1px solid #444', maxWidth: '600px', margin: '0 auto' }}>
          <h3>Register New Character Sheet</h3>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label>Character Name:</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} required style={{ width: '100%', padding: '6px', background: '#222', color: '#fff', border: '1px solid #444' }} />
            </div>
            <div>
              <label>Specialty / Role:</label>
              <input type="text" value={newSpecialty} onChange={e => setNewSpecialty(e.target.value)} placeholder="e.g. Alchemy, Combat" style={{ width: '100%', padding: '6px', background: '#222', color: '#fff', border: '1px solid #444' }} />
            </div>
            <div>
              <label>Assigned Master / Owner:</label>
              <input type="text" value={newOwner} onChange={e => setNewOwner(e.target.value)} placeholder="e.g. Domina Vespera" style={{ width: '100%', padding: '6px', background: '#222', color: '#fff', border: '1px solid #444' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              <div><label>STR:</label><input type="number" value={str} onChange={e => setStr(e.target.value)} style={{ width: '100%', padding: '6px', background: '#222', color: '#fff', border: '1px solid #444' }} /></div>
              <div><label>DEX:</label><input type="number" value={dex} onChange={e => setDex(e.target.value)} style={{ width: '100%', padding: '6px', background: '#222', color: '#fff', border: '1px solid #444' }} /></div>
              <div><label>CON:</label><input type="number" value={con} onChange={e => setCon(e.target.value)} style={{ width: '100%', padding: '6px', background: '#222', color: '#fff', border: '1px solid #444' }} /></div>
              <div><label>INT:</label><input type="number" value={int} onChange={e => setInt(e.target.value)} style={{ width: '100%', padding: '6px', background: '#222', color: '#fff', border: '1px solid #444' }} /></div>
              <div><label>WIS:</label><input type="number" value={wis} onChange={e => setWis(e.target.value)} style={{ width: '100%', padding: '6px', background: '#222', color: '#fff', border: '1px solid #444' }} /></div>
              <div><label>CHA:</label><input type="number" value={cha} onChange={e => setCha(e.target.value)} style={{ width: '100%', padding: '6px', background: '#222', color: '#fff', border: '1px solid #444' }} /></div>
            </div>
            <button type="submit" style={{ background: '#4caf50', color: '#fff', padding: '10px', border: 'none', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}>Save Sheet to Ledger</button>
          </form>
        </div>
      ) : currentSlave && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ background: '#1e1e1e', padding: '20px', borderRadius: '8px', border: '1px solid #333' }}>
            <h3>{currentSlave.name} ({currentSlave.rank})</h3>
            <p><strong>Owner:</strong> {currentSlave.owner} | <strong>Player:</strong> {currentSlave.player}</p>
            <p><strong>Specialty:</strong> {currentSlave.specialty} | <strong>Food Allowance:</strong> {rankInfo.food}</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', margin: '15px 0' }}>
              {[
                ['STR', currentSlave.str], ['DEX', currentSlave.dex], ['CON', currentSlave.con],
                ['INT', currentSlave.int], ['WIS', currentSlave.wis], ['CHA', currentSlave.cha]
              ].map(([stat, val]) => (
                <div key={stat} style={{ background: '#2a2a2a', padding: '10px', textAlign: 'center', borderRadius: '6px' }}>
                  <div style={{ fontSize: '12px', color: '#aaa' }}>{stat}</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{val}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: '#1e1e1e', padding: '20px', borderRadius: '8px', border: '1px solid #333' }}>
            <h3>🎲 D&D Dice Roller</h3>
            <DiceRoller rankMod={rankInfo.mod} stats={{ STR: currentSlave.str, DEX: currentSlave.dex, CON: currentSlave.con, INT: currentSlave.int, WIS: currentSlave.wis, CHA: currentSlave.cha }} />
          </div>
        </div>
      )}
    </div>
  );
}