import React,{useEffect,useState} from 'react';
import './front-cargo.css';

const number=value=>Number(value||0);
const initial=()=>({seller_settlement_id:'',buyer_settlement_id:'',quantity:10});
export default function LogisticsNpcBargaining({request}){
 const [data,setData]=useState({offers:[],settlements:[]});
 const [draft,setDraft]=useState(initial());
 const [quote,setQuote]=useState(null);
 const [counter,setCounter]=useState({});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function load(){
  try{const result=await request('/world-admin/logistics/npc-bargains');setData(result);setError('')}
  catch(err){setError(err.message||'Unable to load trade negotiations')}
 }
 useEffect(()=>{void load()},[]);
 const act=async(path,body,success)=>{
  setBusy(true);setError('');setNotice('');
  try{const result=await request(path,{method:'POST',body});setNotice(success);await load();return result}
  catch(err){setError(err.message||'The proposal could not be processed');return null}
  finally{setBusy(false)}
 };
 const offer=async()=>{const result=await act('/world-admin/logistics/npc-bargains',{seller_settlement_id:number(draft.seller_settlement_id),buyer_settlement_id:number(draft.buyer_settlement_id),quantity:number(draft.quantity)},'Proposal entered for staff review.');if(result){setDraft(initial());setQuote(null)}};
 const preview=async()=>{
  setBusy(true);setError('');setQuote(null);
  try{setQuote(await request('/world-admin/logistics/npc-bargains/quote',{method:'POST',body:{seller_settlement_id:number(draft.seller_settlement_id),buyer_settlement_id:number(draft.buyer_settlement_id),quantity:number(draft.quantity)}}))}
  catch(err){setError(err.message||'No valid offer for these settlements')}
  finally{setBusy(false)}
 };
 const names=Object.fromEntries((data.settlements||[]).map(s=>[s.id,s.name]));
 const canQuote=draft.seller_settlement_id&&draft.buyer_settlement_id&&draft.seller_settlement_id!==draft.buyer_settlement_id&&Number.isInteger(number(draft.quantity))&&number(draft.quantity)>0&&number(draft.quantity)<=10000;
 return <section className="freight-list fc-panel">
  <div className="fc-heading"><div><span>FACTION ECONOMY / NEGOTIATION LEDGER</span><h3>NPC Trade Negotiations</h3><p>Trade prices respond to actual food reserves, shortages, trust, and tension. Any accepted agreement moves real NPC food; payment figures are negotiated terms, not automatically transferred gil.</p></div><button type="button" onClick={()=>void load()}>Refresh</button></div>
  {error&&<p className="wa-error" role="alert">{error}</p>}{notice&&<p className="wa-notice" role="status">{notice}</p>}
  <div className="fc-box"><h4>Propose a food trade</h4><p>Choose existing NPC settlements with sufficient reserves and the necessary diplomatic trade access. The offer cannot create supplies or overwrite established faction controls.</p>
   <div className="fc-fields">
    <label>Seller<select value={draft.seller_settlement_id} onChange={e=>{setDraft({...draft,seller_settlement_id:e.target.value});setQuote(null)}}><option value="">Select source</option>{data.settlements.map(s=><option value={s.id} key={s.id}>{s.name} · {number(s.food_units).toLocaleString()} food</option>)}</select></label>
    <label>Buyer<select value={draft.buyer_settlement_id} onChange={e=>{setDraft({...draft,buyer_settlement_id:e.target.value});setQuote(null)}}><option value="">Select destination</option>{data.settlements.filter(s=>String(s.id)!==String(draft.seller_settlement_id)).map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label>
    <label>Food units<input type="number" step="1" min="1" max="10000" value={draft.quantity} onChange={e=>{setDraft({...draft,quantity:e.target.value});setQuote(null)}}/></label>
   </div>
   <div className="fc-shipment-actions"><button disabled={busy||!canQuote} onClick={()=>void preview()}>Calculate trade quote</button><button disabled={busy||!canQuote||!quote} onClick={()=>void offer()}>Propose agreement</button></div>
   {quote&&<div className="fc-shipment"><strong>Indicative negotiation price: {number(quote.quote_per_unit).toLocaleString()} gil/unit · {number(quote.total_value).toLocaleString()} gil total</strong><p>Trust {quote.trust}/100 · Tension {quote.tension}/100. Quoted terms only: no gil is debited or credited without a real treasury settlement workflow.</p></div>}
  </div>
  <div className="fc-box"><h4>Active proposals and outcomes</h4>
   {data.offers.map(x=><article className="fc-shipment" key={x.id}>
    <div className="fc-shipment-head"><div><strong>{x.seller_name||names[x.seller_settlement_id]} → {x.buyer_name||names[x.buyer_settlement_id]}</strong><small>{x.quantity} food units · Quote {number(x.quote_per_unit).toLocaleString()} gil/unit · Current offer {number(x.offer_per_unit).toLocaleString()} gil/unit</small></div><span className={'freight-status is-'+x.status}>{x.status}</span></div>
    {['proposed','countered'].includes(x.status)&&<div className="fc-shipment-actions"><label>Counteroffer price<input type="number" min="1" step="1" max={x.quote_per_unit*3} value={counter[x.id]??x.offer_per_unit} onChange={e=>setCounter(old=>({...old,[x.id]:e.target.value}))}/></label><button disabled={busy||!Number.isInteger(number(counter[x.id]??x.offer_per_unit))||number(counter[x.id]??x.offer_per_unit)<1} onClick={()=>void act('/world-admin/logistics/npc-bargains/'+x.id+'/counter',{offer_per_unit:number(counter[x.id]??x.offer_per_unit)},'Counteroffer recorded.')}>Counter</button><button disabled={busy} onClick={()=>void act('/world-admin/logistics/npc-bargains/'+x.id+'/accept',{},'Terms accepted; source food dispatched into a real NPC caravan.')}>Approve & dispatch</button><button disabled={busy} onClick={()=>void act('/world-admin/logistics/npc-bargains/'+x.id+'/reject',{},'Offer rejected.')}>Reject</button></div>}
    {x.status==='accepted'&&<p>Food caravan #{x.shipment_id} dispatched. Price recorded as unsettled terms pending a future treasury integration.</p>}
   </article>)}
   {!data.offers.length&&<p>No trade proposals have been recorded.</p>}
  </div>
 </section>;
}
