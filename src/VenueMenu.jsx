import React,{useEffect} from 'react';
import './imperial-theme.css';
import './venue-site.css';
import OrderEmblem from './OrderEmblem.jsx';

const SIGNATURES=[
 {name:'Blood Moon Velvet',price:'30,000',accent:'cherry',ingredients:['Aged dark spirit (rum or brandy base)','Black cherry reduction','Spiced honey syrup','Blood orange essence','Clove and vanilla finish'],description:'Dark fruit and gentle sweetness settle into a slow, warming finish. A lingering spice leaves a lasting impression.'},
 {name:'The Black Halo',price:'30,000',accent:'coffee',ingredients:['Clear distilled spirit (vodka or gin base)','Citrus peel','Dark botanical bitters','Light mineral finish'],description:'Crisp and deliberate, with minimal sweetness, a faint bitterness, and a clean, chilled finish.'},
 {name:'Crimson Reverie',price:'45,000',accent:'crimson',ingredients:['Aged red wine reduction','Spiced herbal liqueur','Pomegranate essence','Dark berry cordial','Subtle smoked citrus oil'],description:'Deep fruit, gentle sweetness, and warming spice. Elegant, expressive, and made for slow conversation.'},
 {name:'Eclipse Nocturne',price:'50,000',accent:'nocturne',ingredients:['Aged amaro or dark herbal spirit','Espresso-infused liqueur','Black citrus tincture','Light vanilla essence','Smoked salt accent','Cherry garnish'],description:'An almost bitter edge softens into warmth and depth, balancing dark roast notes with smooth sweetness.'},
 {name:'Midnight Eclipse',price:'100,000',accent:'midnight',ingredients:['Dark berry liqueur','Blue curaçao','Fresh lemon juice','Premium clear spirit base','Light sugar rim (optional)'],description:'Bright and cool at first, layered with rich velvet depth. One of the venue’s signature drinks.'},
 {name:'Vampiro',price:'80,000',accent:'vampiro',ingredients:['Blanco tequila','House-made sangrita blend','Fresh lime','Blood-orange soda','Subtle spice infusion'],description:'Bright citrus and mineral notes give way to a savory, spiced depth and a faint sweetness.'}
];
const FOOD_MENU=[
 {name:'The Eclipse Burger',price:'50,000',icon:'fa-burger',style:'burger',description:'A thick, fire-seared beef patty layered with caramelized red onion, crisp lettuce, and a rich house sauce, served on a toasted brioche bun. Finished with a delicate crisp layer for added texture and a smooth, buttery finish.',served:'House-cut crisps or a seasonal accompaniment.'},
 {name:'Eclipse Nachos',price:'30,000',icon:'fa-cheese',style:'nachos',description:'Crisp tortilla chips layered with a rich cheese blend, fresh scallions, house seasoning, and a drizzle of warm sauce. Each bite balances crunch, heat, and savory depth. A generous plate made for sharing—or not.',served:'House salsa on the side.',note:'Optional additions available upon request.'},
 {name:'Garlean Pizza',price:'30,000',icon:'fa-pizza-slice',style:'pizza',description:'A stone-baked crust layered with rich tomato sauce, melted cheese, and thick-cut spiced meat, finished with a light herb seasoning. Crisp at the edges, soft at the center, and packed with bold flavor in every slice.'},
 {name:'Midnight Wellington',price:'50,000',icon:'fa-utensils',style:'wellington',description:'Tender-cut beef, seared and wrapped in a rich herb-and-mushroom duxelles, encased in golden pastry and baked to a flawless finish. Juicy, savory, and deeply satisfying, each slice reveals layers of flavor balanced by a crisp exterior and soft, flavorful core. Finished with fresh herbs and served warm.',served:'Seasonal accompaniment and house sauce.'},
 {name:'Emberfold Macaroni',price:'15,000',icon:'fa-bowl-food',style:'macaroni',description:'Tender pasta folded through a velvety blend of melted cheeses, baked until golden and bubbling. Creamy at the center with a lightly crisped top, this dish balances warmth, richness, and comfort in every bite.'},
 {name:'Eclipse-Cut Steak',price:'90,000',icon:'fa-utensils',style:'steak',description:'Thick-cut steak, seasoned and seared to lock in flavor, then finished with a warm butter glaze and fresh herbs. Tender, juicy, and deeply savory, each slice delivers bold flavor with a clean, satisfying finish.',served:'House sauce and seasonal accompaniment, with garlic butter.'}
];
const OTHER_DRINKS=[
 {title:'On tap / rack',items:[['Limsa Lominsa','Ale · Wine · Rum'],['Garlemald','Wine · Rum'],['Kugane','Sake'],['Ishgard','Wine']]},
 {title:'Non-alcoholic',items:[['Obsidian Tonic','Dark-toned tonic with mineral water, botanicals, and a citrus finish'],['Teas','A curated selection, hot or iced · available upon request'],['Coffee','Rich, expertly brewed coffee'],['Milk','Fresh and chilled, plain or as an accompaniment'],['Water','Still or sparkling, served chilled']]}
];
const DESSERT_MENU=[
 {
  "name": "Crimson Moon Cheesecake",
  "price": "40,000",
  "icon": "fa-cake-candles",
  "style": "crimson-cake",
  "description": "Silky cream cheese filling layered over a buttery base, topped with a rich cherry compote that adds just the right balance of sweetness and tang. Light, refined, and indulgent without being heavy."
 },
 {
  "name": "Gilded Night Cheesecake",
  "price": "15,000",
  "icon": "fa-cake-candles",
  "style": "gilded-cake",
  "description": "A velvety vanilla cheesecake base topped with a rich chocolate layer, finished with warm caramel drizzle and crushed nut garnish. Balanced between sweet and decadent, with a soft texture that melts into a lingering finish."
 },
 {
  "name": "Velvet Dusk Mousse",
  "price": "15,000",
  "icon": "fa-spoon",
  "style": "mousse",
  "description": "Silky dark chocolate mousse served chilled, topped with a soft cream finish and fine chocolate curls. Light in texture but rich in flavor, this dessert melts on the tongue and lingers just long enough to satisfy without overwhelming."
 },
 {
  "name": "Scarlet Veil Parfait",
  "price": "15,000",
  "icon": "fa-ice-cream",
  "style": "parfait",
  "description": "Bright raspberries layered with smooth cream and a lightly sweetened crumble base. Each spoonful balances freshness and richness, offering a clean finish with just enough sweetness to linger."
 }
];

function MenuPhoto({name}) {
 const slug=name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
 return <img className="venue-card-photo" src={'/venue-images/'+slug+'.jpg'} alt={name} loading="lazy" onError={event=>{event.currentTarget.hidden=true}}/>;
}

function VenueMark(){return <span className="venue-mark" aria-hidden="true"><OrderEmblem className="venue-order-emblem"/></span>}
export default function VenueMenu(){
 useEffect(()=>{document.title='The Menu — The Midnight Eclipse';return()=>{document.title='Imperium Noctis — A Final Fantasy XIV Roleplay Free Company'}},[]);
 return <div className="midnight-venue venue-menu-page">
  <a className="venue-skip" href="#venue-menu-main">Skip to menu</a>
  <header className="venue-header"><a className="venue-brand" href="/venue/"><VenueMark/><span>THE MIDNIGHT <em>ECLIPSE</em><small>AN IMPERIUM NOCTIS VENUE</small></span></a>
   <nav aria-label="Menu navigation"><a href="/venue/">Venue home</a><a href="#menu">Drinks</a><a href="#food">Food</a><a href="#desserts">Desserts</a><a href="/venue/#travel">Travel & location</a><a href="/venue/rules/">Venue Rules</a></nav>
  </header>
  <main id="venue-menu-main">
   <section className="venue-menu-intro"><div className="venue-inner"><span className="venue-eyebrow">THE MIDNIGHT ECLIPSE · HOUSE SELECTION</span><h1>THE <em>MENU.</em></h1><p>Drinks, kitchen specialties, and sweets for evenings beneath the eclipse.</p><div className="venue-menu-categories"><a href="#menu">Drinks</a><a href="#food">Food</a><a href="#desserts">Desserts</a></div></div></section>
   <section className="venue-section venue-menu" id="menu"><div className="venue-inner"><div className="venue-section-top"><span className="venue-eyebrow">02 / HOUSE SELECTION</span><h2>The menu.<br/><em>Crafted for the occasion.</em></h2><p>Signature drinks, Garlean-inspired meals, and sweets from our kitchen. All prices are in-character gil only; no real-money purchases.</p></div><div className="venue-menu-grid">{SIGNATURES.map((drink,i)=><article key={drink.name} className="venue-drink-card"><div className={'venue-drink-art venue-drink-'+drink.accent}><MenuPhoto name={drink.name}/><span className="venue-glass-bowl"/><span className="venue-glass-stem"/><span className="venue-glass-foot"/><span className="venue-drink-index">0{i+1}</span></div><div className="venue-drink-copy"><div className="venue-drink-heading"><h3>{drink.name}</h3><span>{drink.price} Gil</span></div><p>{drink.description}</p><details><summary>Composition <i className="fa-solid fa-chevron-down" aria-hidden="true"/></summary><ul>{drink.ingredients.map(ingredient=><li key={ingredient}>{ingredient}</li>)}</ul></details></div></article>)}</div>
    <div className="venue-other-grid">{OTHER_DRINKS.map(group=><article className="venue-other-card" key={group.title}><h3>{group.title}</h3><div>{group.items.map(([name,detail])=><div className="venue-other-item" key={name}><strong>{name}</strong><span>{detail}</span></div>)}</div></article>)}</div></div></section>
   <section className="venue-section venue-food" id="food" aria-labelledby="venue-food-heading"><div className="venue-inner">
    <div className="venue-section-top"><span className="venue-eyebrow">03 / FROM THE KITCHEN</span><h2 id="venue-food-heading">Food at<br/><em>the Eclipse.</em></h2><p>From rich Garlean-inspired specialties to familiar comfort food, our kitchen has something for a long conversation or a late-night feast. All prices are in-character gil only.</p></div>
    <div className="venue-food-grid">{FOOD_MENU.map((dish,index)=><article className="venue-food-card" key={dish.name}>
     <div className={'venue-food-art venue-food-art-'+dish.style}><MenuPhoto name={dish.name}/><div className="venue-food-plate"><i className={'fa-solid '+dish.icon}/></div><span className="venue-food-index">{String(index+1).padStart(2,'0')} / THE KITCHEN</span></div>
     <div className="venue-food-copy"><div className="venue-food-heading"><h3>{dish.name}</h3><strong>{dish.price} Gil</strong></div><p>{dish.description}</p>
      {dish.served&&<p className="venue-food-served"><strong>Served with</strong><span>{dish.served}</span></p>}
      {dish.note&&<p className="venue-food-note">{dish.note}</p>}
     </div>
    </article>)}</div>
   </div></section>
   <section className="venue-section venue-desserts" id="desserts" aria-labelledby="venue-desserts-heading"><div className="venue-inner">
    <div className="venue-section-top"><span className="venue-eyebrow">04 / THE SWEET FINISH</span><h2 id="venue-desserts-heading">Desserts.<br/><em>After dark.</em></h2><p>Something sweet to finish the evening. All prices are in-character gil only.</p></div>
    <div className="venue-food-grid">{DESSERT_MENU.map((dish,index)=><article className="venue-food-card venue-dessert-card" key={dish.name}>
     <div className={'venue-food-art venue-food-art-'+dish.style}><MenuPhoto name={dish.name}/><div className="venue-food-plate" aria-hidden="true"><i className={'fa-solid '+dish.icon}/></div><span className="venue-food-index">{String(index+1).padStart(2,'0')} / DESSERTS</span></div>
     <div className="venue-food-copy"><div className="venue-food-heading"><h3>{dish.name}</h3><strong>{dish.price} Gil</strong></div><p>{dish.description}</p></div>
    </article>)}</div>
   </div></section>

  </main>
  <footer className="venue-footer"><div><VenueMark/><span>THE MIDNIGHT ECLIPSE<small>AN IMPERIUM NOCTIS VENUE</small></span></div><div><a href="/venue/">Back to the venue</a><a href="/">Imperium Noctis</a><a href="/venue/rules/">Venue Rules</a><a href="#venue-menu-main">Back to top ↑</a></div><small>Menu prices are in-character gil only. Not affiliated with Square Enix.</small></footer>
 </div>;
}
