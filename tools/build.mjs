import { mkdir, writeFile, cp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { products } from '../src/catalog.mjs';
import { home, catalogPage, productPage, downloadsPage, supportPage, aboutPage, notFound } from '../src/pages.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.join(root, 'dist');
// Only remove the exact generated output directory under this worktree.
if (path.dirname(out) !== root.replace(/[\\/]$/, '') || path.basename(out) !== 'dist') throw new Error('Unsafe output path');
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
await cp(path.join(root,'public'),out,{recursive:true});
const routes = new Map([['/',home()],['/plugins',catalogPage()],['/downloads',downloadsPage()],['/support',supportPage()],['/about',aboutPage()]]);
for (const p of products) {
  if (!/^[a-z0-9-]+$/.test(p.slug)) throw new Error('Invalid product slug');
  if (routes.has(`/plugins/${p.slug}`)) throw new Error('Duplicate product route');
  routes.set(`/plugins/${p.slug}`,productPage(p));
}
for (const [route,html] of routes) {
  const directory = path.join(out,route);
  await mkdir(directory,{recursive:true});
  await writeFile(path.join(directory,'index.html'),html);
}
await writeFile(path.join(out,'404.html'),notFound());
await writeFile(path.join(out,'catalog.json'),JSON.stringify(products,null,2));
await writeFile(path.join(out,'robots.txt'),'User-agent: *\nDisallow: /\n');
await writeFile(path.join(out,'build-manifest.json'),JSON.stringify({builtAt:new Date().toISOString(),routes:[...routes.keys()],commerceEnabled:false},null,2));
console.log(`Built ${routes.size} routes to dist. Commerce and public downloads remain disabled.`);
