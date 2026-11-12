import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {readPipedSecret} from '../src/terminal-secret.js';

test('desktop migration accepts an explicitly submitted blank password',async()=>{
 assert.equal(await readPipedSecret(Readable.from(['\n'])),'');
 assert.equal(await readPipedSecret(Readable.from(['\r\n'])),'');
});
test('desktop migration still accepts regular secret input without echoing it',async()=>{
 assert.equal(await readPipedSecret(Readable.from(['my-secret\r\n'])),'my-secret');
});
test('desktop migration rejects missing input rather than assuming no password',async()=>{
 await assert.rejects(readPipedSecret(Readable.from([])),/Missing desktop administrator credential response/);
 await assert.rejects(readPipedSecret(Readable.from(['unterminated'])),/Missing desktop administrator credential response/);
});
test('desktop migration rejects terminal and oversized input',async()=>{
 const tty=Readable.from(['\n']);tty.isTTY=true;
 await assert.rejects(readPipedSecret(tty),/private input pipe/);
 await assert.rejects(readPipedSecret(Readable.from(['X'.repeat(2049),'\n'])),/exceeds/);
});
