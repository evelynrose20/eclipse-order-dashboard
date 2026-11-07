// UI-only sample records. Never POSTed or seeded into the database.
export const DEMO_PARTIES=[
 {id:101,name:'Cassian Iron Bloc',abbreviation:'CIB',color:'#BF525B',manifesto:'A disciplined New Cassia with strong defenses, intelligence and secure commercial routes.',leader_name:'Senator Valen',leader_id:'preview-a',members:8,state:'active'},
 {id:102,name:'Trade Directorate',abbreviation:'TRD',color:'#D2A04E',manifesto:'Expand licensed fronts, supply networks and foreign trade throughout Ilsabard.',leader_name:'Senator Cora',leader_id:'preview-b',members:6,state:'active'},
 {id:103,name:'Civic Accord',abbreviation:'CVA',color:'#51BFA0',manifesto:'Strengthen the city through negotiated alliances, rebuilding and public confidence.',leader_name:'Senator Vera',leader_id:'preview-c',members:4,state:'active'},
 {id:104,name:'Shadow Caucus',abbreviation:'SHD',color:'#7A91D0',manifesto:'Keep the Order’s intelligence operations powerful and its influence discreet.',leader_name:'Senator Sol',leader_id:'preview-d',members:4,state:'active'}
];
const split=[101,101,101,101,101,101,102,102,102,102,103,103,103,104,104];
export const DEMO_POLITICS={
 enabled:false,can_manage:true,actor_id:'preview-user',my_party_id:null,
 parties:DEMO_PARTIES,
 seats:split.map((party_id,i)=>({seat_number:i+1,account_id:'sample-'+i,party_id,holder:'Senator '+String(i+1).padStart(2,'0')})),
 election:{id:1,title:'First Cassian Senate Election',phase:'campaign',term_days:90,created_at:'2026-11-07'},
 elections:[{id:1,title:'First Cassian Senate Election',phase:'campaign',term_days:90,created_at:'2026-11-07'}],
 candidates:[],results:[],tallies:[],ballot_count:0,has_voted:false,
 heads:[{head_number:1,title:'Domina',holder:'Head of the Order'},{head_number:2,title:'Second Head',holder:'Appointed Head'},{head_number:3,title:'Third Head',holder:'Appointed Head'}],
 coalitions:[{id:1,title:'Cassian Accord',agreement:'A limited agreement on security and new trade routes.',state:'active',parties:[{party_id:101,status:'accepted'},{party_id:103,status:'accepted'}]}],
 bills:[
  {id:41,title:'Charter of New Cassian Trade Routes',category:'commerce',sponsor_name:'Senator Cora',state:'open',yes:8,no:4,abstain:1,electorate:18,quorum_required:9,description:'Establish new agreements for overland supplies and officially licensed fronts.'},
  {id:42,title:'Northern Security and Intelligence Accord',category:'operations',sponsor_name:'Senator Valen',state:'draft',yes:0,no:0,abstain:0,electorate:0,quorum_required:0,description:'Expand intelligence exchange and establish oversight of strategic routes.'},
  {id:40,title:'New Cassia Reconstruction Initiative',category:'general',sponsor_name:'Senator Vera',state:'passed',yes:12,no:3,abstain:2,electorate:18,quorum_required:9,description:'Coordinate material deliveries and construction efforts across New Cassia.'}
 ],
 history:[{action:'election_investiture',subject:'First Senate',detail:'Fifteen seats confirmed',created_at:'2026-11-07'}]
};
