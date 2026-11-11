import React,{useMemo} from 'react';
import SearchPicker from './SearchPicker.jsx';

/**
 * Dashboard-wide searchable dropdown, adapted for legacy <option> lists.
 * Uses the existing SearchPicker theme and keyboard controls instead of
 * falling back to the browser's native select widget.
 */
function optionLabel(node){
 if(node==null||typeof node==='boolean')return '';
 if(typeof node==='string'||typeof node==='number')return String(node);
 if(Array.isArray(node))return node.map(optionLabel).join('');
 if(React.isValidElement(node))return optionLabel(node.props.children);
 return '';
}
export default function LogisticsSelect({children,value='',onChange,disabled=false,required=false,placeholder, 'aria-label':ariaLabel}){
 const options=useMemo(()=>React.Children.toArray(children).flatMap(option=>{
  if(!React.isValidElement(option)||option.type!=='option')return [];
  const key=String(option.props.value??'');
  return [{id:key,name:optionLabel(option.props.children),description:'',disabled:!!option.props.disabled}];
 }),[children]);
 const prompt=placeholder||options.find(item=>item.id==='')?.name||'Choose an item';
 const choices=options.filter(item=>item.id!==''&&!item.disabled);
 return <div className="lp-search-select">
  <SearchPicker portal value={value??''} options={choices} placeholder={prompt}
   ariaLabel={ariaLabel||prompt} disabled={disabled} required={required} groupByCategory={false}
   onChange={id=>onChange?.({target:{value:id}})}/>
 </div>;
}
