import React from 'react';
import { RANKS } from '../data/initialData';

export default function MasterDashboard({ slaves, onUpdateRank, onDeleteSlave }) {
  return (
    <div>
      <h2>Master Control Dashboard ({slaves.length} Registered Character Sheets)</h2>
      <p style={{ color: '#aaa', fontSize: '13px' }}>Global master view: manage all player ranks, review food rations, and audit automated payout splits.</p>

      <div style={{ overflowX: 'auto', marginTop: '15px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#1e1e1e' }}>
          <thead>
            <tr style={{ background: '#2c2c2c', color: '#ff4d4d', textAlign: 'left' }}>
              <th style={{ padding: '10px', border: '1px solid #444' }}>Character / Player</th>
              <th style={{ padding: '10px', border: '1px solid #444' }}>Assigned Master</th>
              <th style={{ padding: '10px', border: '1px solid #444' }}>Rank & Privileges</th>
              <th style={{ padding: '10px', border: '1px solid #444' }}>Food Rations</th>
              <th style={{ padding: '10px', border: '1px solid #444' }}>Pocket Gil Cut</th>
              <th style={{ padding: '10px', border: '1px solid #444' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {slaves.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#777' }}>No character sheets registered in the ledger yet.</td>
              </tr>
            ) : slaves.map(slave => {
              const rankInfo = RANKS[slave.rank] || RANKS["Rank I: Unbroken"];
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
                      onChange={(e) => onUpdateRank(slave.id, e.target.value)}
                      style={{ background: '#2a2a2a', color: '#fff', padding: '6px', border: `1px solid ${rankInfo.color}`, borderRadius: '4px' }}
                    >
                      {Object.keys(RANKS).map(r => <option key={r} value={r}>{r} ({RANKS[r].cut}%)</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #444', fontSize: '13px' }}>{rankInfo.food}</td>
                  <td style={{ padding: '10px', border: '1px solid #444', color: '#4caf50' }}>{slave.gil.toLocaleString()} Gil ({rankInfo.cut}%)</td>
                  <td style={{ padding: '10px', border: '1px solid #444' }}>
                    <button 
                      onClick={() => onDeleteSlave(slave.id)}
                      style={{ background: '#a94442', color: '#fff', border: 'none', padding: '5px 10px', cursor: 'pointer', borderRadius: '3px', fontSize: '12px' }}
                    >
                      Purge
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}