import {createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';

const scrypt=promisify(scryptCallback);
const SETTINGS={N:16384,r:8,p:1,keylen:64,maxmem:64*1024*1024};
const encode=buf=>buf.toString('base64url');
const safePassword=p=>typeof p==='string'&&p.length>=16&&p.length<=1024&&Buffer.byteLength(p,'utf8')<=2048;
export const validPassword=safePassword;
export function normalizeEmail(email){
 if(typeof email!=='string')return null;
 const value=email.trim().toLowerCase();
 if(value.length<5||value.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))return null;
 return value;
}
export async function hashPassword(password){
 if(!safePassword(password))throw new Error('Choose a password at least 16 characters long (maximum 1024 characters).');
 const salt=randomBytes(24);
 const derived=await scrypt(password,salt,SETTINGS.keylen,{N:SETTINGS.N,r:SETTINGS.r,p:SETTINGS.p,maxmem:SETTINGS.maxmem});
 return ['scrypt','1',SETTINGS.N,SETTINGS.r,SETTINGS.p,encode(salt),encode(derived)].join('$');
}
export async function verifyPassword(password,stored){
 if(typeof password!=='string'||password.length>1024||!stored)return false;
 const bits=String(stored).split('$');
 if(bits.length!==7||bits[0]!=='scrypt'||bits[1]!=='1')return false;
 const [N,r,p]=bits.slice(2,5).map(Number);
 if(N!==SETTINGS.N||r!==SETTINGS.r||p!==SETTINGS.p)return false;
 try{
  const salt=Buffer.from(bits[5],'base64url');
  const expected=Buffer.from(bits[6],'base64url');
  if(salt.length!==24||expected.length!==SETTINGS.keylen)return false;
  const actual=await scrypt(password,salt,expected.length,{N,r,p,maxmem:SETTINGS.maxmem});
  return timingSafeEqual(actual,expected);
 }catch{return false}
}
export const generateToken=()=>randomBytes(32).toString('base64url');
export const hashToken=token=>createHash('sha256').update(token,'utf8').digest('hex');
