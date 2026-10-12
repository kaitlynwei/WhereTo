import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');
process.env.NODE_ENV ||= 'production';
process.env.WHERETO_API_HOST ||= '0.0.0.0';

await import('../server/index.js');
