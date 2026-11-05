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
