import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import supportHandler from '../api/support.js';
const root = path.resolve(fileURLToPath(new URL('../dist/',import.meta.url)));
const port = Number(process.env.PORT || 4174);
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8'};
const server = http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; media-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname); } catch {res.writeHead(400).end();return;}
  if (pathname === '/api/support') {
    let bytes=0;const chunks=[];
    for await (const chunk of req) {bytes+=chunk.length;if(bytes>12000){res.writeHead(413,{'Content-Type':'application/json'}).end(JSON.stringify({ok:false,sent:false,message:'Request is too large.'}));return;}chunks.push(chunk);}
    req.body=Buffer.concat(chunks).toString('utf8');
    return supportHandler(req,res);
  }
  if (pathname.startsWith('/api/')) {res.writeHead(410,{'Content-Type':'application/json'}).end(JSON.stringify({message:'This service is retired in the local storefront preview.'}));return;}
  if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405,{Allow:'GET, HEAD'}).end();return;}
  const target=path.resolve(root,`.${pathname}`);
  if (!(target===root||target.startsWith(root+path.sep))||pathname.includes('\\')) {res.writeHead(403).end();return;}
  let file=target;let statusCode=200;
  try {if((await stat(file)).isDirectory()) file=path.join(file,'index.html');await stat(file);} catch {file=path.join(root,'404.html');statusCode=404;}
  try {const data=await readFile(file);res.writeHead(statusCode,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':data.length});res.end(req.method==='HEAD'?undefined:data);} catch {res.writeHead(500).end('Build the site first: npm run build');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Hex the Engineer local preview: http://127.0.0.1:${port}`));
