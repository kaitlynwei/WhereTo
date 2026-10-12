import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.ttf', 'font/ttf'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

const staticSecurityHeaders = {
  // Google Places photo requests use the page origin to validate the
  // browser-restricted Maps key. Send only the origin cross-site; never the
  // route, query, or hash.
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

function safeFilePath(rootDir, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const relativePath = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const candidate = path.resolve(rootDir, relativePath);
  const relative = path.relative(rootDir, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return candidate;
}

async function existingFile(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return false;
    throw error;
  }
}

function cacheControl(filePath) {
  if (path.basename(filePath) === 'index.html') return 'no-cache';
  if (filePath.includes(`${path.sep}assets${path.sep}`) && /-[\w-]{6,}\.[^.]+$/.test(filePath)) {
    return 'public, max-age=31536000, immutable';
  }
  return 'public, max-age=3600';
}

export function createStaticFileHandler({ rootDir }) {
  const root = path.resolve(rootDir);
  const indexPath = path.join(root, 'index.html');

  return async function serveStaticFile(request, response, url) {
    if (request.method !== 'GET' && request.method !== 'HEAD') return false;

    const requestedPath = safeFilePath(root, url.pathname);
    if (!requestedPath) return false;

    let filePath = requestedPath;
    if (!(await existingFile(filePath))) {
      const acceptsHtml = String(request.headers.accept ?? '').includes('text/html');
      if (!acceptsHtml || !(await existingFile(indexPath))) return false;
      filePath = indexPath;
    }

    const body = await readFile(filePath);
    response.writeHead(200, {
      ...staticSecurityHeaders,
      'Cache-Control': cacheControl(filePath),
      'Content-Length': String(body.length),
      'Content-Type': contentTypes.get(path.extname(filePath).toLowerCase()) ?? 'application/octet-stream',
    });
    response.end(request.method === 'HEAD' ? undefined : body);
    return true;
  };
}
