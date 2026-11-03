/**
 * scripts/preview.mjs
 * Lightweight zero-dependency HTTP server for previewing dist/ locally.
 */
import { createServer } from 'node:http';
import { existsSync, statSync, createReadStream } from 'node:fs';
import { resolve, join, extname } from 'node:path';

const ROOT_DIR = resolve(process.cwd());
const DIST_DIR = join(ROOT_DIR, 'dist');
let PORT = parseInt(process.env.PORT || '3000', 10);

if (!existsSync(DIST_DIR)) {
  console.error(`\x1b[31mError: Output directory '${DIST_DIR}' does not exist. Run 'npm run build' first.\x1b[0m`);
  process.exit(1);
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg'
};

function serveFile(req, res, filePath) {
  const ext = extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  });
  createReadStream(filePath).pipe(res);
}

export function startPreviewServer(port = PORT) {
  const server = createServer((req, res) => {
    let reqUrl = req.url.split('?')[0].split('#')[0];
    try {
      reqUrl = decodeURIComponent(reqUrl);
    } catch {
      res.writeHead(400);
      return res.end('Bad Request');
    }

    let filePath = join(DIST_DIR, reqUrl);

    // If path is a directory or root, look for index.html
    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
      filePath = join(filePath, 'index.html');
    } else if (!existsSync(filePath) && existsSync(filePath + '.html')) {
      filePath = filePath + '.html';
    } else if (!existsSync(filePath) && existsSync(join(filePath, 'index.html'))) {
      filePath = join(filePath, 'index.html');
    }

    if (existsSync(filePath) && statSync(filePath).isFile()) {
      serveFile(req, res, filePath);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`404 Not Found: ${reqUrl}`);
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      port++;
      server.listen(port);
    } else {
      console.error('Server error:', err);
    }
  });

  server.listen(port, () => {
    console.log(`\n======================================================`);
    console.log(`🌐 Azure AI-200 Study Hub Local Preview Server`);
    console.log(`   URL: \x1b[36mhttp://localhost:${port}/\x1b[0m`);
    console.log(`   Root: ${DIST_DIR}`);
    console.log(`   Press Ctrl+C to stop.`);
    console.log(`======================================================\n`);
  });

  return server;
}

// Only auto-start if invoked directly via CLI
if (process.argv[1] && process.argv[1].endsWith('preview.mjs')) {
  startPreviewServer();
}
