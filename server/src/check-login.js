import {askSecret,askAccountEmail} from './terminal-secret.js';
const host='http://127.0.0.1:'+Number(process.env.API_PORT||3182);
async function main(){
 const email=await askAccountEmail('Domina email to test: ');
 const password=await askSecret('Password (hidden): ');
 const response=await fetch(host+'/auth/login',{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({email,password})
 });
 const body=await response.json();
 if(!response.ok)throw new Error(body.error||'Login failed (HTTP '+response.status+')');
 const token=body.access_token;
 if(!token)throw new Error('No session token returned.');
 const me=await fetch(host+'/auth/me',{headers:{Authorization:'Bearer '+token}});
 const profile=await me.json();
 if(!me.ok)throw new Error(profile.error||'Session check failed');
 console.log('Login verified:',profile.user?.display_name, '| Role:',profile.user?.role);
 const logout=await fetch(host+'/auth/logout',{method:'POST',headers:{Authorization:'Bearer '+token}});
 console.log(logout.status===204?'Session logout and revocation succeeded.':'Logout returned HTTP '+logout.status);
 // Token and password intentionally never printed.
}
main().catch(error=>{console.error('Login test failed:',error.message);process.exitCode=1;});
