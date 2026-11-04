import React, { useState, useEffect } from 'react';
import { INITIAL_SLAVES } from './data/initialData';
import LoginTerminal from './components/LoginTerminal';
import MasterDashboard from './components/MasterDashboard';
import CharacterSheet from './components/CharacterSheet';
import BlackMarketShop from './components/BlackMarketShop';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null); // 'master' or 'player'
  const [activeTab, setActiveTab] = useState('sheets'); // 'master', 'sheets', 'shop'

  const [slaves, setSlaves] = useState(() => {
    const saved = localStorage.getItem('fc_slaves_modular');
    return saved ? JSON.parse(saved) : INITIAL_SLAVES;
  });

  useEffect(() => {
    localStorage.setItem('fc_slaves_modular', JSON.stringify(slaves));
  }, [slaves]);

  const handleLogin = (username, role) => {
    setCurrentUser(username);
    setUserRole(role);
    if (role === 'master') setActiveTab('master');
    else setActiveTab('sheets');
  };

  const updateRank = (id, newRank) => {
    setSlaves(slaves.map(s => s.id === id ? { ...s, rank: newRank } : s));
  };

  const addSlave = (newSlave) => {
    setSlaves([newSlave, ...slaves]);
  };

  const deleteSlave = (id) => {
    if (window.confirm("Are you sure you want to purge this character from the ledger?")) {
      setSlaves(slaves.filter(s => s.id !== id));
    }
  };

  if (!currentUser) {
    return <LoginTerminal onLogin={handleLogin} />;
  }

  return (
    <div style={{ background: '#121212', color: '#e0e0e0', minHeight: '100vh', fontFamily: 'Segoe UI, sans-serif', padding: '20px' }}>
      {/* Top Navbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #8b0000', paddingBottom: '10px', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, color: '#ff4d4d', fontSize: '22px' }}>⛓️ FFXIV Crime FC Hub</h1>
        <div>
          <span style={{ marginRight: '15px', fontSize: '13px', color: '#aaa' }}>User: <strong style={{ color: '#fff' }}>{currentUser}</strong> ({userRole.toUpperCase()})</span>
          <button onClick={() => setCurrentUser(null)} style={{ background: '#333', color: '#ff4d4d', border: '1px solid #ff4d4d', padding: '5px 10px', cursor: 'pointer', borderRadius: '4px', fontSize: '12px' }}>Disconnect</button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        {userRole === 'master' && (
          <button 
            onClick={() => setActiveTab('master')} 
            style={{ background: activeTab === 'master' ? '#8b0000' : '#222', color: '#fff', border: 'none', padding: '8px 16px', cursor: 'pointer', borderRadius: '4px' }}
          >
            Master Dashboard
          </button>
        )}
        <button 
          onClick={() => setActiveTab('sheets')} 
          style={{ background: activeTab === 'sheets' ? '#8b0000' : '#222', color: '#fff', border: 'none', padding: '8px 16px', cursor: 'pointer', borderRadius: '4px' }}
        >
          Character Sheets & Dice
        </button>
        <button 
          onClick={() => setActiveTab('shop')} 
          style={{ background: activeTab === 'shop' ? '#8b0000' : '#222', color: '#fff', border: 'none', padding: '8px 16px', cursor: 'pointer', borderRadius: '4px' }}
        >
          Black Market & Rations
        </button>
      </div>

      {/* Content Render */}
      {activeTab === 'master' && userRole === 'master' && (
        <MasterDashboard slaves={slaves} onUpdateRank={updateRank} onDeleteSlave={deleteSlave} />
      )}
      {activeTab === 'sheets' && (
        <CharacterSheet slaves={slaves} currentUser={currentUser} onAddSlave={addSlave} />
      )}
      {activeTab === 'shop' && (
        <BlackMarketShop />
      )}
    </div>
  );
}