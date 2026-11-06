import React from 'react';
import Dashboard from './src/Dashboard.jsx';
import LocalAccounts from './src/LocalAccounts.jsx';
import PublicSite from './src/PublicSite.jsx';

// The public website is the default. Accounts and gameplay remain inside /portal.
// This preserves the existing Windows/MySQL portal and the legacy fallback.
export default function App(){
 const path=window.location.pathname.replace(/\/+$/,'')||'/';
 const memberRoute=path==='/portal'||path==='/app'||path.startsWith('/portal/');
 if(memberRoute)return import.meta.env.VITE_ECLIPSE_API_URL?<LocalAccounts/>:<Dashboard/>;
 return <PublicSite/>;
}
