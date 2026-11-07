import React,{useEffect,useState} from 'react';
import Commerce from './Commerce.jsx';

export default function TradeWorkspace({request,characters=[],canManage=false,readOnly=false}){
 const [materials,setMaterials]=useState([]);
 const [error,setError]=useState('');
 useEffect(()=>{
  let alive=true;
  request('/workshop').then(data=>{if(alive)setMaterials(data.materials||[])}).catch(e=>{if(alive)setError(e.message)});
  return()=>{alive=false}
 },[request]);
 return <>{error&&<p className="alert" role="alert">{error}</p>}<Commerce request={request} characters={characters} canManage={canManage} readOnly={readOnly} materials={materials}/></>;
}
