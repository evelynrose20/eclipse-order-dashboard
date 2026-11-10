import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';

// GitHub Pages serves static files: a React route alone cannot handle a fresh
// request for /venue. Publish a real /venue/index.html entrypoint alongside
// the homepage, using the same built React bundle and client-side route.
const dist=new URL('../dist/',import.meta.url);
const html=await readFile(new URL('index.html',dist),'utf8');
if(!/<script[^>]+src="\/assets\//.test(html))throw new Error('Expected root-relative bundled assets for GitHub Pages nested routes');
await mkdir(new URL('venue/',dist),{recursive:true});
await writeFile(new URL('venue/index.html',dist),html);
