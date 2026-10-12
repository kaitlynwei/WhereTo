import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const apiPort = Number(process.env.WHERETO_API_PORT || 8787);
const webPort = 5173;

const portAvailable = (port) => new Promise((resolve) => {
  const probe = net.createServer();
  probe.once('error', () => resolve(false));
  probe.once('listening', () => probe.close(() => resolve(true)));
  probe.listen(port, '127.0.0.1');
});

const [apiAvailable, webAvailable] = await Promise.all([
  portAvailable(apiPort),
  portAvailable(webPort),
]);

if (!apiAvailable || !webAvailable) {
  const occupied = [!apiAvailable && `backend port ${apiPort}`, !webAvailable && `website port ${webPort}`].filter(Boolean).join(' and ');
  console.error(`WhereTo is already running or ${occupied} is occupied. Close the older WhereTo terminal with Control + C, then run npm run dev again.`);
  process.exit(1);
}

const children = [
  spawn(process.execPath, ['--env-file=.env', '--watch', 'server/index.js'], { cwd: root, stdio: 'inherit' }),
  spawn(process.execPath, [viteBin, '--strictPort'], { cwd: root, stdio: 'inherit' }),
];

let stopping = false;
const stop = () => {
  if (stopping) return;
  stopping = true;
  children.forEach((child) => child.kill('SIGTERM'));
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
children.forEach((child) => child.on('exit', (code) => {
  if (!stopping) {
    if (code && code !== 0) process.exitCode = code;
    stop();
  }
}));
