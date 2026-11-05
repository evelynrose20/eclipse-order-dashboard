import React from 'react';
import Dashboard from './src/Dashboard.jsx';
import LocalAccounts from './src/LocalAccounts.jsx';

// The Windows/MySQL member portal is selected when its API URL is configured.
// Without it, the historical browser/Supabase compatibility dashboard is shown.
export default function App(){
 return import.meta.env.VITE_ECLIPSE_API_URL ? <LocalAccounts/> : <Dashboard/>;
}
