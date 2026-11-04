import React from 'react';
import { SHOP_ITEMS } from '../data/initialData';

export default function BlackMarketShop() {
  return (
    <div>
      <h2>Black Market & Rations Catalog</h2>
      <p style={{ color: '#aaa', fontSize: '13px' }}>Underworld gear, restraints, and rank-restricted nutritional tiers.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '15px' }}>
        <div style={{ background: '#1e1e1e', padding: '20px', borderRadius: '8px', border: '1px solid #333' }}>
          <h3>🛒 Contraband Shop</h3>
          {SHOP_ITEMS.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#252525', padding: '10px', marginBottom: '8px', borderRadius: '4px' }}>
              <div>
                <strong>{item.name}</strong><br />
                <span style={{ fontSize: '11px', color: '#aaa' }}>Req: {item.rank} | {item.effect}</span>
              </div>
              <span style={{ color: '#ffb74d', fontWeight: 'bold' }}>{item.cost.toLocaleString()} Gil</span>
            </div>
          ))}
        </div>

        <div style={{ background: '#1e1e1e', padding: '20px', borderRadius: '8px', border: '1px solid #333' }}>
          <h3>🍲 Food & Rations Schedule</h3>
          {[
            { rank: "Rank I: Unbroken", food: "Gruel & Hardtack Broth", cost: "Free (Provided)", note: "-1 Energy Penalty" },
            { rank: "Rank II: Indentured", food: "Coerthian Stew & Salt Meats", cost: "500 Gil", note: "Standard Baseline" },
            { rank: "Rank III: Specialized", food: "Doman Rice, Steaks & Wine", cost: "2,500 Gil", note: "+1 Stat Buffer (24h)" },
            { rank: "Rank IV: Elite", food: "VIP Feast & Fine Vintage", cost: "10,000 Gil", note: "+2 Morale & Stats (24h)" }
          ].map((tier, idx) => (
            <div key={idx} style={{ background: '#252525', padding: '10px', marginBottom: '8px', borderRadius: '4px' }}>
              <strong>{tier.rank}</strong><br />
              <span style={{ color: '#5bc0de' }}>{tier.food}</span> — <span style={{ color: '#ffb74d' }}>{tier.cost}</span><br />
              <span style={{ fontSize: '11px', color: '#888' }}>Effect: {tier.note}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}