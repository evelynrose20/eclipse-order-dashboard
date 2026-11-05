export const RANKS = {
  "Unbound: Free": {mod:0,color:"#a9b4c7"},
  "Rank I: Fresh Intake / Unbroken": {mod:-2,color:"#d9534f"},
  "Rank II: Initiate / Indentured": {mod:0,color:"#f0ad4e"},
  "Rank III: Trusted / Specialized": {mod:2,color:"#5bc0de"},
  "Rank IV: Elite / Favor of the Domina": {mod:3,color:"#5cb85c"}
};

export const INITIAL_SLAVES = [
  { id:1,name:"Lyra",player:"@UserA",owner:"Domina Vespera",rank:"Rank I: Fresh Intake / Unbroken",specialty:"Alchemy Assistant",str:10,dex:12,con:10,int:14,wis:8,cha:12,hp:20,notes:"Fresh intake. Unbroken." },
  { id:2,name:"Kaelen",player:"@UserB",owner:"Master Thorne",rank:"Rank II: Initiate / Indentured",specialty:"Housework & Serving",str:12,dex:10,con:12,int:10,wis:10,cha:14,hp:22,notes:"Passed basic training." },
  { id:3,name:"Rian",player:"@UserC",owner:"Domina Vespera",rank:"Rank III: Trusted / Specialized",specialty:"Enforcer / Combat",str:16,dex:14,con:14,int:8,wis:10,cha:10,hp:30,notes:"Trusted combat asset." }
];
