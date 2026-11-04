export const RANKS = {
  "Unbound: Free": { cut: 100, food: "Free choice", mod: 0, color: "#a9b4c7" },
  "Rank I: Fresh Intake / Unbroken": { cut: 0, food: "Gruel & Broth (Basic)", mod: -2, color: "#d9534f" },
  "Rank II: Initiate / Indentured": { cut: 10, food: "Coerthian Stew & Meats", mod: 0, color: "#f0ad4e" },
  "Rank III: Trusted / Specialized": { cut: 25, food: "Doman Rice & Grilled Steaks", mod: 2, color: "#5bc0de" },
  "Rank IV: Elite / Favor of the Domina": { cut: 40, food: "VIP Feast & Fine Wine", mod: 3, color: "#5cb85c" }
};

export const INITIAL_SLAVES = [
  { id: 1, name: "Lyra", player: "@UserA", owner: "Domina Vespera", rank: "Rank I: Fresh Intake / Unbroken", specialty: "Alchemy Assistant", str: 10, dex: 12, con: 10, int: 14, wis: 8, cha: 12, hp: 20, gil: 0, notes: "Fresh intake. Unbroken." },
  { id: 2, name: "Kaelen", player: "@UserB", owner: "Master Thorne", rank: "Rank II: Initiate / Indentured", specialty: "Housework & Serving", str: 12, dex: 10, con: 12, int: 10, wis: 10, cha: 14, hp: 22, gil: 1200, notes: "Passed basic training." },
  { id: 3, name: "Rian", player: "@UserC", owner: "Domina Vespera", rank: "Rank III: Trusted / Specialized", specialty: "Enforcer / Combat", str: 16, dex: 14, con: 14, int: 8, wis: 10, cha: 10, hp: 30, gil: 15000, notes: "Trusted combat asset." }
];

export const SHOP_ITEMS = [
  { name: "Iron Slave Collar (Heavy)", cost: 2000, rank: "Rank I", effect: "-2 Resistance Checks" },
  { name: "Leather Padded Collar", cost: 5000, rank: "Rank II", effect: "Standard / No Penalty" },
  { name: "Gold-Chased Velvet Collar", cost: 25000, rank: "Rank III", effect: "+1 Charm Modifier" },
  { name: "Somnus Powder Vial", cost: 3000, rank: "Rank II", effect: "Causes Sedation (DC 14 CON)" },
  { name: "Pearl Lane Tonic", cost: 1500, rank: "Rank I", effect: "Restores 10 HP" },
  { name: "Concealed Dagger", cost: 12000, rank: "Rank III", effect: "+2 Attack Check" },
  { name: "Master's Freedom Deed", cost: 500000, rank: "Rank IV", effect: "Grants Full Manumission" }
];