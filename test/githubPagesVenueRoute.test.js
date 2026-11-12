import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const load=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('GitHub Pages publishes Order pages without retired venue routes',()=>{
 const config=load('vite.config.js');
 const packageJson=JSON.parse(load('package.json'));
 const generator=load('scripts/generate-static-routes.mjs');
 const html=load('index.html');
 assert.match(config,/base:\s*'\/'/);
 assert.match(packageJson.scripts.build,/vite build && node scripts\/generate-static-routes\.mjs/);
 assert.doesNotMatch(generator,/route: '\/venue/);
 assert.match(generator,/page.route.slice\(1\)/);
 assert.match(generator,/readFile\(new URL\('index.html', dist\)/);
 assert.match(html,/href="\/favicon\.svg"/);
});
