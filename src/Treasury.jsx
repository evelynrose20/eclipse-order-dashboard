import React,{useEffect,useState} from 'react';
import './treasury.css';

const money=n=>Number(n||0).toLocaleString()+' gil';
const cycleLabel=s=>s?new Date(s+'T12:00:00Z').toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}):'Not run yet';

export default function Treasury({request,characters=[],canManage=false,readOnly=false}){
 const [data,setData]=useState(null),[missions,setMissions]=useState(null);
 const [tab,setTab]=useState('overview'),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [settings,setSettings]=useState(null),[eventId,setEventId]=useState(''),[characterId,setCharacterId]=useState(''),[missionAmount,setMissionAmount]=useState(5);
 const [wallet,setWallet]=useState(null),[walletId,setWalletId]=useState('');
 const command=canManage&&!readOnly;
 async function refresh(){
  const result=await request('/treasury');setData(result);setSettings(result.settings);
  if(command){const next=await request('/treasury/missions');setMissions(next)}
 }
 useEffect(()=>{refresh().catch(e=>setError(e.message))},[]);
 useEffect(()=>{
  if(!walletId){setWallet(null);return}
  let live=true;request('/treasury/characters/'+walletId).then(w=>{if(live)setWallet(w)}).catch(e=>{if(live)setError(e.message)});
  return()=>{live=false}
 },[walletId]);
 const own=data?.characters||[];
 const totalWallets=own.reduce((sum,c)=>sum+Number(c.wallet),0);
 async function submit(path,body,success){
  setBusy(true);setError('');setNotice('');
  try{
   await request(path,{method:'POST',body});await refresh();
   if(walletId){const w=await request('/treasury/characters/'+walletId);setWallet(w)}
   setNotice(success);
  }catch(e){setError(e.message||String(e))}
  finally{setBusy(false)}
 }
 const saveSettings=()=>submit('/treasury/settings',{member_daily:Number(settings.member_daily),bound_daily:Number(settings.bound_daily),reset_hour_utc:Number(settings.reset_hour_utc),enabled:!!settings.enabled},'Daily wage policy updated.');
 const selectedEvent=missions?.events.find(e=>e.id===eventId);
 const paid=missions?.paid.find(p=>p.event_id===eventId&&p.character_id===characterId);
 const award=()=>submit('/treasury/missions/'+eventId+'/pay/'+characterId,{amount:Number(missionAmount)},'Mission payment credited to the character wallet.');
 return <section className="eo-treasury">
  <header className="eo-treasury-hero"><div><span>THE ECLIPSE ORDER · FINANCIAL LEDGER</span><h2>The Order's Treasury</h2><p>Every gil comes from trade. Wages and mission rewards draw from the same funds, and an empty treasury cannot promise a payout.</p></div><div aria-hidden="true" className="eo-treasury-crest">♛</div></header>
  {error&&<p className="alert" role="alert">{error.replaceAll('_',' ')}</p>}
  {notice&&<p role="status" className="eo-treasury-notice">{notice}</p>}
  {!data?<section className="panel">Opening the treasury ledger…</section>:<>
   <div className="eo-treasury-vitals">
    <div className="eo-treasury-balance"><span>TREASURY · AVAILABLE</span><strong>{money(data.balance)}</strong><small>Trade-funded FC balance</small></div>
    <div><span>YOUR CHARACTERS' WALLETS</span><strong>{money(totalWallets)}</strong><small>Across {own.length} linked character{own.length===1?'':'s'}</small></div>
    <div><span>LAST DAILY RESET</span><strong>{cycleLabel(data.latest_run?.cycle_date)}</strong><small>{data.latest_run?money(data.latest_run.paid_total)+' distributed':'No payroll has run yet'}</small></div>
   </div>
   <nav className="eo-treasury-tabs" aria-label="Treasury sections">
    <button type="button" className={tab==='overview'?'current':''} onClick={()=>setTab('overview')}>Treasury & wages</button>
    <button type="button" className={tab==='wallets'?'current':''} onClick={()=>setTab('wallets')}>Character wallets</button>
    {command&&<><button type="button" className={tab==='missions'?'current':''} onClick={()=>setTab('missions')}>Mission pay</button><button type="button" className={tab==='ledger'?'current':''} onClick={()=>setTab('ledger')}>Full ledger</button></>}
   </nav>
   {tab==='overview'&&<div className="eo-treasury-grid">
    <section className="eo-treasury-panel">
     <span className="eo-treasury-eyebrow">DAILY WAGE POLICY</span><h3>Small wages, paid at reset</h3>
     <p>Every linked character receives a daily wage when funds are available. Bound characters are paid at the lower rate. Payments are recorded directly in individual character wallets.</p>
     <div className="eo-treasury-paybands"><div><span>ORDER MEMBER</span><strong>{money(settings?.member_daily)}</strong><small>per linked character / reset</small></div><div><span>BOUND CHARACTER</span><strong>{money(settings?.bound_daily)}</strong><small>per linked character / reset</small></div></div>
     <div className="eo-treasury-reset"><span>RESET HOUR</span><strong>{String(settings?.reset_hour_utc??15).padStart(2,'0')}:00 UTC</strong><small>Processed by the running Windows API. Restarting cannot pay a reset twice.</small></div>
     {command&&<div className="eo-treasury-policy-editor"><h4>Adjust Order pay</h4><div className="eo-treasury-fields"><label>Member / day<input type="number" min="0" max="10000" value={settings.member_daily} onChange={e=>setSettings({...settings,member_daily:e.target.value})}/></label><label>Bound / day<input type="number" min="0" max="10000" value={settings.bound_daily} onChange={e=>setSettings({...settings,bound_daily:e.target.value})}/></label><label>Reset hour (UTC)<select value={settings.reset_hour_utc} onChange={e=>setSettings({...settings,reset_hour_utc:e.target.value})}>{Array.from({length:24},(_,i)=><option key={i} value={i}>{String(i).padStart(2,'0')}:00</option>)}</select></label></div><label className="eo-treasury-toggle"><input type="checkbox" checked={!!settings.enabled} onChange={e=>setSettings({...settings,enabled:e.target.checked})}/> Daily wage payouts enabled</label><button type="button" disabled={busy||Number(settings.bound_daily)>Number(settings.member_daily)} onClick={saveSettings}>Save pay policy</button></div>}
    </section>
    <section className="eo-treasury-panel eo-treasury-operations"><span className="eo-treasury-eyebrow">HOW THE ECONOMY WORKS</span><h3>Trade fuels the Order</h3>
     <div className="eo-treasury-flow"><div><span>01</span><strong>Deliver a trade order</strong><small>Materials leave FC stores or a crafted item leaves a character's bag</small></div><div><span>02</span><strong>Buyer pays the treasury</strong><small>Contract's gil value × units successfully delivered</small></div><div><span>03</span><strong>Wages and event pay</strong><small>Withdraw from the same treasury with a permanent ledger entry</small></div></div>
     <p className="eo-treasury-caution">If money is short, daily pay is proportionally reduced. Missing wages are not created as debt or paid twice later. Mission pay requires sufficient treasury funds.</p>
     {command&&<div className="eo-treasury-run-history"><h4>Recent resets</h4>{data.runs.slice(0,8).map(run=><div key={run.cycle_date}><span>{cycleLabel(run.cycle_date)} · {run.recipients} characters</span><strong>{money(run.paid_total)} / {money(run.requested_total)}</strong></div>)}{!data.runs.length&&<p>The payroll ledger will populate at the next processed reset.</p>}</div>}
    </section>
   </div>}
   {tab==='wallets'&&<div className="eo-treasury-wallet-layout"><section className="eo-treasury-wallet-list"><h3>Linked character wallets</h3>{own.map(c=><button type="button" className={walletId===c.id?'current':''} key={c.id} onClick={()=>setWalletId(c.id)}><div><strong>{c.character_name}</strong><small>{c.collar_bound?'Bound character':'Order member'}</small></div><span>{money(c.wallet)}</span></button>)}{!own.length&&<p>No linked character sheets yet. Daily wages require a linked character.</p>}</section><section className="eo-treasury-panel"><h3>Payment history</h3>{walletId&&wallet?<><div className="eo-treasury-wallet-amount">{money(wallet.balance)}</div>{wallet.history.map((h,i)=><div className="eo-treasury-transaction" key={i}><span>{h.kind==='daily_pay'?'Daily wages':'Completed mission'}<small>{new Date(h.created_at).toLocaleString()}</small></span><strong>+{money(h.amount)}</strong></div>)}{!wallet.history.length&&<p>No payments to this character yet.</p>}</>:<p>Select a character to see their individual payments.</p>}</section></div>}
   {tab==='missions'&&command&&<div className="eo-treasury-grid"><section className="eo-treasury-panel"><span className="eo-treasury-eyebrow">COMPLETED EVENT REWARD</span><h3>Authorize mission pay</h3><p>Only completed events are eligible. The character must have participated, and the same character can receive payment only once for that event. Funds must already be in the treasury.</p>
     <div className="eo-treasury-fields stacked"><label>Completed event<select value={eventId} onChange={e=>setEventId(e.target.value)}><option value="">Choose event</option>{(missions?.events||[]).map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label><label>Participating character<select value={characterId} onChange={e=>setCharacterId(e.target.value)}><option value="">Choose character</option>{(missions?.characters||[]).map(c=><option key={c.id} value={c.id}>{c.character_name}</option>)}</select></label><label>Pay (gil)<input type="number" min="1" max="10000" value={missionAmount} onChange={e=>setMissionAmount(e.target.value)}/></label></div>
     {paid&&<p className="eo-treasury-notice">This character already received {money(paid.amount)} for this event.</p>}
     <button type="button" disabled={busy||!selectedEvent||!characterId||!!paid||Number(missionAmount)<1||Number(missionAmount)>data.balance} onClick={award}>Pay completed mission</button>
    </section><section className="eo-treasury-panel"><span className="eo-treasury-eyebrow">RECENT AUTHORIZED REWARDS</span><h3>Mission payments</h3>{(missions?.paid||[]).slice(0,15).map((p,i)=><div key={i} className="eo-treasury-transaction"><span>{missions?.events.find(e=>e.id===p.event_id)?.name||'Completed event'}<small>{missions?.characters.find(c=>c.id===p.character_id)?.character_name||'Character'}</small></span><strong>{money(p.amount)}</strong></div>)}{!missions?.paid?.length&&<p>No mission payments yet.</p>}</section></div>}
   {tab==='ledger'&&command&&<section className="eo-treasury-panel"><span className="eo-treasury-eyebrow">THE ORDER'S ACCOUNTS</span><h3>Income & expenses</h3><div className="eo-treasury-ledger-head"><span>TRANSACTION</span><span>CHANGE</span><span>AFTER</span></div>{data.ledger.map(l=><div className="eo-treasury-ledger-row" key={l.id}><div><strong>{l.category.replaceAll('_',' ')} · {l.character_name||'Order'}</strong><small>{l.note} · {new Date(l.created_at).toLocaleString()}</small></div><strong className={l.direction==='income'?'plus':'minus'}>{l.direction==='income'?'+':'−'}{money(l.amount)}</strong><span>{money(l.balance_after)}</span></div>)}{!data.ledger.length&&<p>No treasury transactions yet. Only priced deliveries create income.</p>}</section>}
  </>}
 </section>;
}
