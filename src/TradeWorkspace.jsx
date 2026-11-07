import React,{useEffect,useState} from 'react';
import Commerce from './Commerce.jsx';

export default function TradeWorkspace({request,characters=[],canManage=false,readOnly=false}){
 const [materials,setMaterials]=useState([]);
 const [error,setError]=useState('');
 const refreshMaterials=()=>request('/workshop').then(data=>setMaterials(data.materials||[]));
 useEffect(()=>{
  let alive=true;
  request('/workshop').then(data=>{if(alive)setMaterials(data.materials||[])}).catch(e=>{if(alive)setError(e.message)});
  return()=>{alive=false}
 },[request]);
 return <>{error&&<p className="alert" role="alert">{error}</p>}<Commerce request={request} characters={characters} canManage={canManage} readOnly={readOnly} materials={materials} onTradeComplete={refreshMaterials}/></>;
}
