import React, { useState } from 'react';

export default function LoginTerminal({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanUser = username.trim();
    if (!cleanUser) return;

    // Strict Master Check
    if (cleanUser.toLowerCase() === 'elira') {
      if (password === 'EmpSolas') {
        onLogin(cleanUser, 'master');
      } else {
        setErrorMsg('ACCESS DENIED: Invalid passcode for Master Elira.');
      }
      return;
    }

    // Regular Member Login (no master password required)
    onLogin(cleanUser, 'player');
  };

  return (
    <div style={{ background: '#0a0a0a', color: '#00ff66', minHeight: '100vh', fontFamily: 'Courier New, monospace', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
      <div style={{ background: '#111', border: '2px solid #00ff66', padding: '30px', borderRadius: '8px', width: '100%', maxWidth: '400px', boxShadow: '0 0 20px rgba(0, 255, 102, 0.2)' }}>
        <h2 style={{ marginTop: 0, color: '#00ff66', textAlign: 'center', borderBottom: '1px dashed #00ff66', paddingBottom: '10px' }}>SYS_ACCESS // SYNDICATE v2.7</h2>
        <p style={{ fontSize: '12px', color: '#888', textAlign: 'center' }}>[SECURE TERMINAL CONNECTION]</p>
        
        {errorMsg && (
          <div style={{ background: '#330000', color: '#ff4d4d', padding: '8px', marginBottom: '15px', fontSize: '12px', border: '1px solid #ff4d4d', borderRadius: '4px' }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label style={{ fontSize: '13px', display: 'block', marginBottom: '5px' }}>USERNAME / CALLSIGN:</label>
            <input 
              type="text" 
              value={username} 
              onChange={(e) => { setUsername(e.target.value); setErrorMsg(''); }} 
              placeholder="Enter your handle..."
              style={{ width: '100%', background: '#000', border: '1px solid #00ff66', color: '#00ff66', padding: '8px', fontFamily: 'Courier New, monospace', borderRadius: '4px', boxSizing: 'border-box' }}
              required
            />
          </div>
          <div>
            <label style={{ fontSize: '13px', display: 'block', marginBottom: '5px' }}>PASSWORD (Masters Only):</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => { setPassword(e.target.value); setErrorMsg(''); }} 
              placeholder="Leave blank if regular member..."
              style={{ width: '100%', background: '#000', border: '1px solid #00ff66', color: '#00ff66', padding: '8px', fontFamily: 'Courier New, monospace', borderRadius: '4px', boxSizing: 'border-box' }}
            />
          </div>
          <button 
            type="submit" 
            style={{ background: '#00ff66', color: '#000', border: 'none', padding: '10px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Courier New, monospace', borderRadius: '4px', marginTop: '10px' }}
          >
            INITIALIZE CONNECTION
          </button>
        </form>
        <div style={{ marginTop: '20px', fontSize: '11px', color: '#555', textAlign: 'center' }}>
          Master: Elira / EmpSolas<br />Members: Enter any handle.
        </div>
      </div>
    </div>
  );
}