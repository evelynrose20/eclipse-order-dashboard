import React from 'react';
import Dashboard from './src/Dashboard.jsx';
import LocalAccounts from './src/LocalAccounts.jsx';

// Existing Supabase site is kept intact until all Windows endpoints are implemented.
// To test the local registration system, set VITE_ECLIPSE_API_URL in local .env.
export default function App(){
 return import.meta.env.VITE_ECLIPSE_API_URL ? <LocalAccounts/> : <Dashboard/>;
}
