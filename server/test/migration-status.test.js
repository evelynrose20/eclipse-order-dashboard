import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {trackedMigrationVersions,compareMigrationVersions,statusWithPool} from '../src/migration-status.js';

test('detects missing tracked migrations without inventing database state',()=>{
 const setup="await readFile(new URL('../sql/126_restore_trade_ledger_activity.sql',import.meta.url));\nawait readFile(new URL('../sql/127_rp_starter_preset_marker.sql',import.meta.url));";
 const sql={
  '126_restore_trade_ledger_activity.sql':"INSERT INTO schema_migrations(version) VALUES('126_restore_trade_ledger_activity')",
  '127_rp_starter_preset_marker.sql':"INSERT INTO schema_migrations(version) VALUES('127_rp_starter_preset_marker')"
 };
 const expected=trackedMigrationVersions(setup,sql);
 assert.deepEqual(expected,['126_restore_trade_ledger_activity','127_rp_starter_preset_marker']);
 const status=compareMigrationVersions(expected,['126_restore_trade_ledger_activity']);
 assert.equal(status.status,'update_available');
 assert.deepEqual(status.missing,['127_rp_starter_preset_marker']);
 assert.equal(compareMigrationVersions(expected,expected).status,'current');
});
test('migration status is read-only',async()=>{
 let statement='';
 const db={query:async sql=>{statement=sql;return [[{version:'126_restore_trade_ledger_activity'}]]}};
 const setup="await readFile(new URL('../sql/127_rp_starter_preset_marker.sql',import.meta.url));";
 const sql={'127_rp_starter_preset_marker.sql':"INSERT INTO schema_migrations(version) VALUES('127_rp_starter_preset_marker')"};
 const status=await statusWithPool(db,setup,sql);
 assert.equal(status.pending,1);
 assert.match(statement,/^SELECT version FROM schema_migrations$/);
});
test('actual setup registers current RP marker as a tracked SQL version',async()=>{
 const setup=await readFile(new URL('../src/setup-local.js',import.meta.url),'utf8');
 const sql=await readFile(new URL('../sql/127_rp_starter_preset_marker.sql',import.meta.url),'utf8');
 const expected=trackedMigrationVersions(setup,{'127_rp_starter_preset_marker.sql':sql});
 assert.deepEqual(expected,['127_rp_starter_preset_marker']);
});
