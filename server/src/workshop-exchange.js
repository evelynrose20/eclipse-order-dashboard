// Auto-demand is drawn exclusively from FC Workshop & Garden catalogs.
// This module never reads the city-builder industry inventory or creates stock.
const qtyByCategory={ore:14,herb:12,botanical:10,refined:8,supply:10};
const priceByCategory={ore:9,herb:13,botanical:17,refined:24,supply:20};
export const workshopDemandProfile=good=>{
 const equipment=good.kind==='equipment';
 const seed=[...String(good.id)].reduce((value,ch)=>(value*33+ch.charCodeAt(0))%104729,7);
 return {
  seed,
  quantity:equipment?2+seed%3:(qtyByCategory[good.category]||8)+seed%5,
  unitPrice:equipment?55+seed%30:(priceByCategory[good.category]||12)+seed%7,
  reputation:equipment?3:1+seed%3
 };
};

export async function syncWorkshopBuyOrders(pool){
 const [[materials],[equipment],[factions],[authors]]=await Promise.all([
  pool.query('SELECT id,name,category FROM fc_materials ORDER BY id'),
  pool.query('SELECT id,name,slot FROM fc_equipment_templates WHERE enabled=1 ORDER BY id'),
  pool.query("SELECT id,name FROM order_factions WHERE public_visible=1 AND trade_enabled=1 AND id<>'eclipse-order' ORDER BY id"),
  pool.query("SELECT id FROM accounts WHERE account_role='domina' AND is_active=1 AND approval_status='approved' ORDER BY created_at LIMIT 1")
 ]);
 // Without a genuine public buyer and an approved Order issuer, do not fabricate participants.
 if(!factions.length||!authors.length)return 0;
 const goods=[...materials.map(m=>({...m,kind:'material'})),...equipment.map(e=>({...e,kind:'equipment',category:e.slot}))];
 const conn=await pool.getConnection();
 let created=0;
 try{
  await conn.beginTransaction();
  for(const good of goods){
   await conn.execute('INSERT IGNORE INTO fc_trade_auto_demand(item_kind,item_id) VALUES(?,?)',[good.kind,good.id]);
   const [[state]]=await conn.execute('SELECT last_contract_id,next_order_at<=UTC_TIMESTAMP() AS ready FROM fc_trade_auto_demand WHERE item_kind=? AND item_id=? FOR UPDATE',[good.kind,good.id]);
   if(!state?.ready)continue;
   if(state.last_contract_id){
    const [[last]]=await conn.execute('SELECT status FROM fc_trade_contracts WHERE id=?',[state.last_contract_id]);
    if(last&&last.status!=='complete')continue;
   }
   const itemColumn=good.kind==='material'?'material_id':'equipment_template_id';
   const [outstanding]=await conn.execute("SELECT id FROM fc_trade_contracts WHERE item_kind=? AND "+itemColumn+"=? AND status IN ('open','paused') LIMIT 1",[good.kind,good.id]);
   if(outstanding.length)continue;
   const plan=workshopDemandProfile(good);
   const faction=factions[plan.seed%factions.length];
   const [result]=await conn.execute('INSERT INTO fc_trade_contracts(faction_id,title,description,item_kind,material_id,equipment_template_id,required_quantity,rep_per_unit,sale_value_per_unit,created_by) VALUES(?,?,?,?,?,?,?,?,?,?)',[
    faction.id,('Merchant request: '+good.name).slice(0,130),
    'Foreign merchant demand for goods from the Order workshop and garden.',
    good.kind,good.kind==='material'?good.id:null,good.kind==='equipment'?good.id:null,
    plan.quantity,plan.reputation,plan.unitPrice,authors[0].id
   ]);
   await conn.execute('UPDATE fc_trade_auto_demand SET last_contract_id=?,next_order_at=DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 DAY) WHERE item_kind=? AND item_id=?',[result.insertId,good.kind,good.id]);
   created++;
  }
  await conn.commit();
  return created;
 }catch(error){await conn.rollback().catch(()=>{});throw error}
 finally{conn.release()}
}
