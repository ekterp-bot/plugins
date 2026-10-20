"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, mkdir, cp, readFile, access, rm } = require("node:fs/promises");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const os = require("node:os");

const root = path.resolve(__dirname, "..");
const origin = "https://www.hextheengineer.com";
const routes = ["/", "/plugins", "/downloads", "/support", "/about", "/plugins/project-nebula"];

test("generated production metadata is public while local and preview builds stay excluded", async t => {
  // Isolate build output so running tests cannot replace a prepared deployment.
  const temporaryRoot = path.resolve(os.tmpdir());
  const fixture = await mkdtemp(path.join(temporaryRoot, "hex-metadata-test-"));
  try {
    await cp(path.join(root, "src"), path.join(fixture, "src"), { recursive: true });
    await cp(path.join(root, "public"), path.join(fixture, "public"), { recursive: true });
    await mkdir(path.join(fixture, "tools"));
    await cp(path.join(root, "tools", "build.mjs"), path.join(fixture, "tools", "build.mjs"));

    for (const environment of ["production", "preview", "development", undefined]) {
      await t.test(environment || "local without VERCEL_ENV", async () => {
        const env = { ...process.env };
        delete env.VERCEL_ENV;
        if (environment !== undefined) env.VERCEL_ENV = environment;
        const result = spawnSync(process.execPath, ["tools/build.mjs"], { cwd: fixture, env, encoding: "utf8" });
        assert.equal(result.status, 0, result.stderr || result.stdout);
        const indexable = environment === "production";
        const dist = path.join(fixture, "dist");
        const manifest = JSON.parse(await readFile(path.join(dist, "build-manifest.json"), "utf8"));
        assert.equal(manifest.indexable, indexable);
        assert.deepEqual(manifest.routes, routes);
        assert.equal(manifest.commerceEnabled, false);

        for (const route of routes) {
          const html = await readFile(path.join(dist, route, "index.html"), "utf8");
          const url = new URL(route, origin).href;
          assert.ok(html.includes(`<meta name="robots" content="${indexable ? "index,follow" : "noindex,nofollow"}">`), route);
          assert.ok(html.includes(`<link rel="canonical" href="${url}">`), route);
          assert.ok(html.includes(`<meta property="og:url" content="${url}">`), route);
          assert.ok(html.includes(`<meta property="og:image" content="${origin}/assets/plugin-interface.webp">`), route);
          assert.match(html, /<meta property="og:title" content="[^"]+">/);
          assert.match(html, /<meta property="og:description" content="[^"]+">/);
          assert.match(html, /PRODUCT PREVIEW/);
          assert.doesNotMatch(html, /LOCAL DESIGN PREVIEW/);
          assert.match(html, /Private beta · Sales and downloads are not open/);
        }

        const missingPage = await readFile(path.join(dist, "404.html"), "utf8");
        assert.match(missingPage, /<meta name="robots" content="noindex,nofollow">/);
        assert.doesNotMatch(missingPage, /rel="canonical"|property="og:url"/);
        const robots = await readFile(path.join(dist, "robots.txt"), "utf8");
        if (indexable) {
          assert.equal(robots, `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
          const sitemap = await readFile(path.join(dist, "sitemap.xml"), "utf8");
          const locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
          assert.deepEqual(locations, routes.map(route => new URL(route, origin).href));
          assert.doesNotMatch(sitemap, /404|api\/|localhost|vercel\.app/);
        } else {
          assert.equal(robots, "User-agent: *\nDisallow: /\n");
          await assert.rejects(access(path.join(dist, "sitemap.xml")), { code: "ENOENT" });
        }
      });
    }
  } finally {
    const resolvedFixture = path.resolve(fixture);
    if (path.dirname(resolvedFixture) !== temporaryRoot || !path.basename(resolvedFixture).startsWith("hex-metadata-test-")) {
      throw new Error("Refusing to remove an unexpected test directory");
    }
    await rm(resolvedFixture, { recursive: true, force: true });
  }
});
