import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
export const sqlite = new DatabaseSync(':memory:');
for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort()) sqlite.exec(readFileSync(new URL('../drizzle/'+file, import.meta.url), 'utf8'));
function statement(sql, values=[]) {
  return {
    bind(...args) { return statement(sql,args); },
    async first() { return sqlite.prepare(sql).get(...values) ?? null; },
    async all() { return {results:sqlite.prepare(sql).all(...values)}; },
    async run() { return {meta:{changes:Number(sqlite.prepare(sql).run(...values).changes)}}; },
  };
}
export const env = { DB: { prepare:statement }, OPENROUTER_API_KEY:'test-only-placeholder', JEV_DAILY_LIMIT:'1000' };
