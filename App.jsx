import React from 'react';
import LocalAccounts from './src/LocalAccounts.jsx';
import PublicSite from './src/PublicSite.jsx';
import LoreArchive from './src/LoreArchive.jsx';

// The public website is the default. Query routing keeps the portal reachable on GitHub Pages.
// A clean /portal path is also supported by hosts with SPA fallback.
// Account access is Discord-only; the old fallback sign-in is deliberately disabled.
export default function App(){
 const path=window.location.pathname.replace(/\/+$/,'')||'/';
 const memberRoute=new URLSearchParams(window.location.search).has('portal')||path==='/portal'||path==='/app'||path.startsWith('/portal/');
 if(memberRoute)return <LocalAccounts/>;
 return <PublicSite/>;
}
