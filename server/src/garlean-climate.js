// Fictional northern Garlean climate, synced to the REAL calendar date (UTC).
// Not an external weather report; stable on a given date and changes by season.
// Temperatures are specified in Fahrenheit and converted for the existing
// internal Celsius-based civic-heating calculations.
export const fToC=fahrenheit=>(fahrenheit-32)*5/9;
export const cToF=celsius=>celsius*9/5+32;
export const MAP_ICONS=['settlement','capital','village','mine','factory','refinery','fortress','outpost','farm','port','depot','ruins','landmark','lumberyard','sawmill','logging-camp','forest','quarry','ranch','fishery','hospital','barracks','rail-station','road-junction','warehouse','market','workshop','ceruleum-plant','drilling-rig','watchtower','bridge','power-plant','government','military-base','mountain','camp','airship-dock','cargo-terminal'];
export const ROUTE_TYPES=['road','trail','rail','skyway','waterway'];
const monthlyF=[9,13,26,39,51,61,67,64,54,40,25,13];
const seasonForMonth=m=>[11,0,1].includes(m)?'winter':[2,3,4].includes(m)?'spring':[5,6,7].includes(m)?'summer':'autumn';
export function garleanWeather(date=new Date()){
 const when=new Date(date);
 if(Number.isNaN(when.getTime()))throw new Error('invalid_date');
 const year=when.getUTCFullYear(),month=when.getUTCMonth(),day=when.getUTCDate();
 // Deterministic daily variation: stable between requests and server restarts.
 const hash=n=>{let x=(n|0)>>>0;x^=x>>>16;x=Math.imul(x,0x7feb352d);x^=x>>>15;x=Math.imul(x,0x846ca68b);x^=x>>>16;return (x>>>0)/4294967296};
 const seed=year*10000+(month+1)*100+day;
 const fluctuation=(hash(seed)-.5)*20;
 const tempF=Math.round(monthlyF[month]+fluctuation);
 const season=seasonForMonth(month);
 const chance=hash(seed+734);
 const weather=season==='winter'?(chance<.26?'snow':chance<.39?'blizzard':chance<.65?'overcast':'clear'):
  season==='spring'?(chance<.24?'rain':chance<.43?'overcast':'clear'):
  season==='summer'?(chance<.18?'rain':chance<.35?'cloudy':'clear'):
  chance<.19?'rain':chance<.38?'overcast':tempF<32&&chance<.48?'snow':'clear';
 return {date:when.toISOString().slice(0,10),season,weather,temperature_f:tempF,temperature_c:Number(fToC(tempF).toFixed(2)),source:'garlean_calendar_model'};
}
export function effectiveWeather(region,now=new Date()){
 if(region.weather_mode==='garlean_seasonal')return garleanWeather(now);
 return {date:new Date(now).toISOString().slice(0,10),season:null,weather:region.weather,temperature_c:Number(region.temperature_c),temperature_f:Math.round(cToF(Number(region.temperature_c))),source:'dm_manual'};
}
export const validMapIcon=icon=>MAP_ICONS.includes(icon);
export const validRouteType=type=>ROUTE_TYPES.includes(type);
export const validWaypoints=points=>Array.isArray(points)&&points.length<=16&&points.every(p=>p&&typeof p==='object'&&Number.isFinite(p.x)&&p.x>=0&&p.x<=100&&Number.isFinite(p.y)&&p.y>=0&&p.y<=100);
