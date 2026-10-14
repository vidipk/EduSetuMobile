import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const source = process.env.OPENAPI_URL ?? process.env.OPENAPI_FILE;
if (!source) {
  console.error('Set OPENAPI_URL or OPENAPI_FILE before running api:generate.');
  process.exit(1);
}
if (process.env.OPENAPI_FILE && !existsSync(process.env.OPENAPI_FILE)) {
  console.error(`OpenAPI file not found: ${process.env.OPENAPI_FILE}`);
  process.exit(1);
}
const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['openapi-typescript', source, '-o', 'src/api/generated/schema.ts'],
  { stdio: 'inherit' },
);
process.exit(result.status ?? 1);
