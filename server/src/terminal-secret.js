import readline from 'node:readline/promises';

// Local terminal-only secret input. Never prints the typed password.
export function askSecret(label){
 return new Promise((resolve,reject)=>{
  const input=process.stdin,output=process.stdout;
  if(!input.isTTY||typeof input.setRawMode!=='function'){
   reject(new Error('Use an interactive local Windows terminal for password entry.'));return;
  }
  let value='';
  output.write(label);
  input.setRawMode(true);input.resume();
  const onData=chunk=>{
   const chars=chunk.toString('utf8');
   if(chars==='\u0003'){cleanup();reject(new Error('Cancelled.'));return;}
   if(chars==='\r'||chars==='\n'){cleanup();output.write('\n');resolve(value);return;}
   if(chars==='\u0008'||chars==='\u007f'){value=value.slice(0,-1);return;}
   if(!chars.includes('\u001b')&&value.length+chars.length<=1024)value+=chars;
  };
  const cleanup=()=>{input.off('data',onData);input.setRawMode(false);input.pause();};
  input.on('data',onData);
 });
}
export async function askAccountEmail(prompt='Account email: '){
 const rl=readline.createInterface({input:process.stdin,output:process.stdout});
 try{return (await rl.question(prompt)).trim();}
 finally{rl.close()}
}

/** Used only by the local desktop manager. Password travels over an anonymous stdin pipe. */
export async function readPipedSecret(input=process.stdin){
 if(input.isTTY)throw new Error('The desktop setup must provide a private input pipe.');
 let secret='';
 for await(const chunk of input){
  secret+=chunk.toString('utf8');
  if(secret.length>2048)throw new Error('Password input exceeds the allowed length.');
 }
 // A deliberate blank line means a local passwordless administrator account.
 // Empty EOF without a line is not valid: the desktop must send an explicit choice.
 const newline=secret.indexOf('\n');
 if(newline<0)throw new Error('Missing desktop administrator credential response.');
 return secret.slice(0,newline).replace(/\r$/,'');
}
