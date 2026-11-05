import test from 'node:test';
import assert from 'node:assert/strict';
import {hashPassword,verifyPassword,hashToken,generateToken,normalizeEmail,validPassword} from '../src/credentials.js';

test('passwords are hashed with random salt, and correct passwords verify',async()=>{
 const password='unique-very-long-local-password!';
 const one=await hashPassword(password),two=await hashPassword(password);
 assert.notEqual(one,two);
 assert.ok(one.startsWith('scrypt$1$'));
 assert.ok(!one.includes(password));
 assert.equal(await verifyPassword(password,one),true);
 assert.equal(await verifyPassword('wrong-password',one),false);
});
test('weak passwords and invalid stored hashes cannot authenticate',async()=>{
 assert.equal(validPassword('tooshort'),false);
 await assert.rejects(hashPassword('tooshort'),/at least 16/);
 assert.equal(await verifyPassword('any','garbage'),false);
 assert.equal(await verifyPassword('any',null),false);
});
test('tokens are random and only their hashes need database storage',()=>{
 const a=generateToken(),b=generateToken();
 assert.notEqual(a,b);
 assert.equal(hashToken(a).length,64);
 assert.notEqual(hashToken(a),a);
 assert.equal(hashToken(a),hashToken(a));
});
test('user emails normalize safely without storing a password in client assets',()=>{
 assert.equal(normalizeEmail('  Example@Rosefires.COM '),'example@rosefires.com');
 assert.equal(normalizeEmail('bad email'),null);
 assert.equal(normalizeEmail({}),null);
});
