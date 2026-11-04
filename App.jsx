import React, { useState, useEffect } from 'react';

// Rank data and configuration
const RANKS = {
  "Rank I: Unbroken": { cut: 0, food: "Gruel & Broth (Basic)", mod: -2, color: "#d9534f" },
  "Rank II: Indentured": { cut: 10, food: "Coerthian Stew & Meats", mod: 0, color: "#f0ad4e" },
  "Rank III: Specialized": { cut: 25, food: "Doman Rice & Grilled Steaks", mod: 2, color: "#5bc0de" },
  "Rank IV: Elite": { cut: 40, food: "VIP Feast & Fine Wine", mod: 3, color: "#5cb85c" }
};

const INITIAL_SLAVES = [
  { id: 1, name: "Lyra", player: "@UserA", owner: "Domina Vespera", rank: "Rank I: Unbroken", specialty: "Alchemy Assistant", str: 10, dex: 12, con: 10, int: 14, wis: 8, cha: 12, hp: 20, gil: 0, notes: "Fresh intake. Unbroken." },
  { id: 2, name: "Kaelen", player: "@UserB", owner: "Master Thorne", rank: "Rank II: Indentured", specialty: "Housework & Serving", str: 12, dex: 10, con: 12, int: 10, wis: 10, cha: 14, hp: 22, gil: 1200, notes: "Passed basic training." },
  { id: 3, name: "Rian", player: "@UserC", owner: "Domina Vespera", rank: "Rank III: Specialized", specialty: "Enforcer / Combat", str: 16, dex: 14, con: 14, int: 8, wis: 10, cha: 10, hp: 30, gil: 15000, notes: "Trusted combat asset." }
];

const SHOP_ITEMS = [
  { name: "Iron Slave Collar (Heavy)", cost: 2000, rank: "Rank I", effect: "-2 Resistance Checks" },
  { name: "Leather Padded Collar", cost: 5000, rank: "Rank II", effect: "Standard / No Penalty" },
  { name: "Gold-Chased Velvet Collar", cost: 25000, rank: "Rank III", effect: "+1 Charm Modifier" },
  { name: "Somnus Powder Vial", cost: 3000, rank: "Rank II", effect: "Causes Sedation (DC 14 CON)" },
  { name: "Pearl Lane Tonic", cost: 1500, rank: "Rank I", effect: "Restores 10 HP" },
  { name: "Concealed Dagger", cost: 12000, rank: "Rank III", effect: "+2 Attack Check" },
  { name: "Master's Freedom Deed", cost: 500000, rank: "Rank IV", effect: "Grants Full Manumission" }
];

export default function App() {
  const [slaves, setSlaves] = useState(() => {
    const saved = localStorage.getItem('fc_slaves');
    return saved ? JSON.parse(saved) : INITIAL_SLAVES;
  });
  
  const [view, setView] = useState('master'); // 'master' or 'player'
  const [selectedSlave, setSelectedSlave] = useState(slaves[0]);
  const [diceResult, setDiceResult] = useState(null);

  useEffect(() => {
    localStorage.setItem('fc_slaves', JSON.stringify(slaves));
  }, [slaves]);

  const updateRank = (id, newRank) => {
    setSlaves(slaves.map(s => s.id === id ? { ...s, rank: newRank } : s));
    if (selectedSlave.id === id) {
      setSelectedSlave({ ...selectedSlave, rank: newRank });
    }
  };

  const rollDice = (statVal, rankMod) => {
    const roll = Math.floor(Math.random() * 20) + 1;
    const statMod = Math.floor((statVal - 10) / 2);
    const total = roll + statMod + rankMod;
    setDiceResult({ roll, statMod, rankMod, total });
  };

  return (
    <div style={{ background: '#121212', color: '#e0e0e0', minHeight: '100vh', fontFamily: 'Segoe UI, sans-serif', padding: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #8b0000', paddingBottom: '10px', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, color: '#ff4d4d', fontSize: '24px' }}>⛓️ FFXIV Crime FC — Underworld Ledger</h1>
        <div>
          <button onClick={() => setView('master')} style={{ background: view === 'master' ? '#8b0000' : '#333', color: '#fff', border: 'none', padding: '8px 16px', marginRight: '10px', cursor: 'pointer', borderRadius: '4px' }}>Master Control Dashboard</button>
          <button onClick={() => setView('player')} style={{ background: view === 'player' ? '#8b0000' : '#333', color: '#fff', border: 'none', padding: '8px 16px', cursor: 'pointer', borderRadius: '4px' }}>Slave Character Sheet & Shop</button>
        </div>
      </div>

      {/* MASTER DASHBOARD VIEW */}
      {view === 'master' && (
        <div>
          <h2>Master Roster & Payment Manager ({slaves.length} Slaves Active)</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#1e1e1e', marginTop: '10px' }}>
              <thead>
                <tr style={{ background: '#2c2c2c', color: '#ff4d4d', textAlign: 'left' }}>
                  <th style={{ padding: '10px', border: '1px solid #444' }}>Name / Player</th>
                  <th style={{ padding: '10px', border: '1px solid #444' }}>Owner</th>
                  <th style={{ padding: '10px', border: '1px solid #444' }}>Rank & Privileges</th>
                  <th style={{ padding: '10px', border: '1px solid #444' }}>Food Rations</th>
                  <th style={{ padding: '10px', border: '1px solid #444' }}>Pocket Gil Cut</th>
                  <th style={{ padding: '10px', border: '1px solid #444' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {slaves.map(slave => {
                  const rankInfo = RANKS[slave.rank];
                  return (
                    <tr key={slave.id} style={{ borderBottom: '1px solid #333' }}>
                      <td style={{ padding: '10px', border: '1px solid #444' }}>
                        <strong>{slave.name}</strong><br />
                        <span style={{ fontSize: '12px', color: '#aaa' }}>{slave.player} ({slave.specialty})</span>
                      </td>
                      <td style={{ padding: '10px', border: '1px solid #444' }}>{slave.owner}</td>
                      <td style={{ padding: '10px', border: '1px solid #444' }}>
                        <select 
                          value={slave.rank} 
                          onChange={(e) => updateRank(slave.id, e.target.value)}
                          style={{ background: '#2a2a2a', color: '#fff', padding: '6px', border: `1px solid ${rankInfo.color}`, borderRadius: '4px' }}
                        >
                          {Object.keys(RANKS).map(r => <option key={r} value={r}>{r} ({RANKS[r].cut}%)</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '10px', border: '1px solid #444', fontSize: '13px' }}>{rankInfo.food}</td>
                      <td style={{ padding: '10px', border: '1px solid #444', color: '#4caf50' }}>{slave.gil.toLocaleString()} Gil ({rankInfo.cut}%)</td>
                      <td style={{ padding: '10px', border: '1px solid #444' }}>
                        <button onClick={() => { setSelectedSlave(slave); setView('player'); }} style={{ background: '#444', color: '#fff', border: 'none', padding: '5px 10px', cursor: 'pointer', borderRadius: '3px' }}>View Sheet</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PLAYER / SLAVE SHEET & SHOP VIEW */}
      {view === 'player' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h2 style={{ margin: 0 }}>Character Sheet: {selectedSlave.name} ({selectedSlave.rank})</h2>
            <select 
              value={selectedSlave.id} 
              onChange={(e) => setSelectedSlave(slaves.find(s => s.id === Number(e.target.value)))}
              style={{ background: '#2a2a2a', color: '#fff', padding: '6px', borderRadius: '4px' }}
            >
              {slaves.map(s => <option key={s.id} value={s.id}>{s.name} - {s.specialty}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Stats & Dice Roller */}
            <div style={{ background: '#1e1e1e', padding: '20px', borderRadius: '8px', border: '1px solid #333' }}>
              <h3>Attributes & D&D Dice Roller</h3>
              <p><strong>Assigned Master:</strong> {selectedSlave.owner} | <strong>Assigned Rations:</strong> {RANKS[selectedSlave.rank].food}</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', margin: '15px 0' }}>
                {[['STR', selectedSlave.str], ['DEX', selectedSlave.dex], ['CON', selectedSlave.con], ['INT', selectedSlave.int], ['WIS', selectedSlave.wis], ['CHA', selectedSlave.cha]].map(([stat, val]) => (
                  <div key={stat} style={{ background: '#2a2a2a', padding: '10px', textAlign: 'center', borderRadius: '6px' }}>
                    <div style={{ fontSize: '12px', color: '#aaa' }}>{stat}</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{val}</div>
                    <button 
                      onClick={() => rollDice(val, RANKS[selectedSlave.rank].mod)}
                      style={{ marginTop: '5px', background: '#8b0000', color: '#fff', border: 'none', padding: '3px 8px', fontSize: '11px', cursor: 'pointer', borderRadius: '3px' }}
                    >
                      Roll d20
                    </button>
                  </div>
                ))}
              </div>

              {diceResult && (
                <div style={{ background: '#252525', padding: '10px', borderRadius: '6px', borderLeft: '4px solid #ff4d4d' }}>
                  <strong>Roll Result:</strong> Rolled [{diceResult.roll}] + Stat Mod [{diceResult.statMod}] + Rank Mod [{diceResult.rankMod}] = <strong style={{ color: '#4caf50', fontSize: '16px' }}>{diceResult.total}</strong>
                </div>
              )}
            </div>

            {/* Black Market Shop & Rations Catalog */}
            <div style={{ background: '#1e1e1e', padding: '20px', borderRadius: '8px', border: '1px solid #333' }}>
              <h3>🛒 Black Market & Gear Shop</h3>
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {SHOP_ITEMS.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#252525', padding: '8px 12px', marginBottom: '8px', borderRadius: '4px' }}>
                    <div>
                      <strong>{item.name}</strong><br />
                      <span style={{ fontSize: '11px', color: '#aaa' }}>Req: {item.rank} | {item.effect}</span>
                    </div>
                    <span style={{ color: '#ffb74d', fontWeight: 'bold' }}>{item.cost.toLocaleString()} Gil</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}