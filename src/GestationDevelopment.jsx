import React from 'react';
import './gestation-development.css';
import {DEVELOPMENT_STAGES,gestationStage} from './gestationStages.js';

// Story-facing development is proportional to the character's saved IC term.
// The 90-day default does not change previously recorded pregnancy lengths.
function DevelopmentIllustration({stage}){
 // A stylized, non-diagnostic cross-section. Six variants deliberately share
 // the same visual frame and scale to make progression easy to compare.
 const scale=[0.13,0.23,0.42,0.61,0.78,0.94][stage];
 const formed=stage>=2;
 return <svg viewBox="0 0 340 290" role="img" aria-label={DEVELOPMENT_STAGES[stage].name+' gestation illustration'} className="gestation-illustration">
  <title>{DEVELOPMENT_STAGES[stage].name}</title>
  <defs>
   <radialGradient id="eo-gestation-fluid"><stop offset="0" stopColor="#354754"/><stop offset="1" stopColor="#1a2935"/></radialGradient>
  </defs>
  <path d="M170 18 C90 14 53 70 58 143 C61 229 108 274 170 274 C232 274 280 229 282 143 C287 70 250 14 170 18Z" fill="#17242e" stroke="#536674" strokeWidth="3"/>
  <path d="M170 36 C108 34 75 82 78 145 C81 214 112 252 170 252 C227 252 260 214 262 145 C266 83 230 34 170 36Z" fill="url(#eo-gestation-fluid)" stroke="#98705d" strokeWidth="1.5"/>
  <g transform={`translate(169 149) scale(${scale}) translate(-169 -149)`}>
   {formed?<g fill="#bd9b87" stroke="#e2c1a7" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
    <path d="M185 132 C207 150 214 180 194 201 C177 216 149 198 145 175 C140 148 158 127 185 132Z"/>
    <ellipse cx="155" cy="111" rx="34" ry="39"/>
    {stage>=3&&<><path d="M171 169 Q202 175 213 189" fill="none"/><path d="M157 182 Q141 208 122 201" fill="none"/></>}
    {stage>=4&&<><path d="M202 186 Q223 212 203 224" fill="none"/><path d="M131 197 Q109 217 121 228" fill="none"/></>}
   </g>:<g fill="#bd9b87" stroke="#e2c1a7" strokeWidth="3"><ellipse cx="170" cy="145" rx={stage===0?18:29} ry={stage===0?18:35}/>{stage===1&&<ellipse cx="153" cy="130" rx="13" ry="15"/>}</g>}
  </g>
  <g stroke="#657985" strokeWidth="1" strokeDasharray="3 6" fill="none"><path d="M33 145H69"/><path d="M271 145H306"/></g>
  <text x="170" y="284" textAnchor="middle" fontSize="9" letterSpacing="1.4" fill="#a1b0b9">GESTATION · IC REFERENCE</text>
 </svg>;
}
export default function GestationDevelopment({days=0,totalDays=90}){
 const {index,stage,fraction}=gestationStage(days,totalDays);
 return <section className="gestation-view" aria-label="Gestation development view">
  <div className="gestation-view-heading"><div><span>DEVELOPMENT OBSERVATION</span><h4>{stage.name}</h4><p>{stage.detail}</p></div><strong>Day {Math.floor(Math.max(0,Number(days)))} / {totalDays}</strong></div>
  <div className="gestation-view-body"><div className="gestation-visual"><DevelopmentIllustration stage={index}/></div>
   <div className="gestation-view-detail"><span>Current developmental stage</span><strong>{String(index+1).padStart(2,'0')} <small>/ 06</small></strong><p>Development advances with the recorded IC pregnancy calendar. Research findings and story outcomes are recorded separately.</p><div className="gestation-stage-track">{DEVELOPMENT_STAGES.map((s,i)=><div key={s.name} className={i===index?'current':i<index?'passed':''}><span>{i+1}</span><small>{s.name}</small></div>)}</div></div>
  </div>
  <div className="gestation-view-progress"><div><span>Gestation progress</span><strong>{Math.round(fraction*100)}%</strong></div><div className="gestation-progress-track"><span style={{width:(fraction*100)+'%'}}/></div></div>
 </section>;
}
