// build-all.mts

import { build, type InlineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import fg from "fast-glob";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import pkg from "./package.json" with { type: "json" };
import tailwindcss from "@tailwindcss/vite";

// src folder
// const entries = fg.sync("src/**/index.{tsx,jsx}");
const entries = fg.sync("src/pizzaz-list/index.{tsx,jsx}");

// output folder
const outDir = "assets";

// css collection, ignore patternsm global css
const PER_ENTRY_CSS_GLOB = "**/*.{css,pcss,scss,sass}";
const PER_ENTRY_CSS_IGNORE = "**/*.module.*".split(",").map((s) => s.trim());
const GLOBAL_CSS_LIST = [path.resolve("src/index.css")];

// target to build
const targets: string[] = [
  "todo",
  "solar-system",
  "pizzaz",
  "pizzaz-carousel",
  "pizzaz-list",
  "pizzaz-albums",
  "pizzaz-video",
];
const builtNames: string[] = [];

// plugin to inject CSS imports
function wrapEntryPlugin(
  virtualId: string,
  entryFile: string,
  cssPaths: string[]
): Plugin {
  return {
    name: `virtual-entry-wrapper:${entryFile}`,
    resolveId(id) {
      if (id === virtualId) return id;
    },
    load(id) {
      if (id !== virtualId) {
        return null;
      }

      const cssImports = cssPaths
        .map((css) => `import ${JSON.stringify(css)};`)
        .join("\n");

      return `
    ${cssImports}
    export * from ${JSON.stringify(entryFile)};

    import * as __entry from ${JSON.stringify(entryFile)};
    export default (__entry.default ?? __entry.App);

    import ${JSON.stringify(entryFile)};
  `;
    },
  };
}

// clear outDir
// fs.rmSync(outDir, { recursive: true, force: true });

// loop entry and build
for (const file of entries) {
  // skip non-targets
  const name = path.basename(path.dirname(file));
  if (targets.length && !targets.includes(name)) {
    continue;
  }

  // path & dir
  const entryAbs = path.resolve(file);
  const entryDir = path.dirname(entryAbs);

  // collect css
  const perEntryCss = fg.sync(PER_ENTRY_CSS_GLOB, {
    cwd: entryDir,
    absolute: true,
    dot: false,
    ignore: PER_ENTRY_CSS_IGNORE,
  });

  // global css 
  const globalCss = GLOBAL_CSS_LIST.filter((p) => fs.existsSync(p));

  // combine css
  const cssToInclude = [...globalCss, ...perEntryCss].filter((p) =>
    fs.existsSync(p)
  );

  const virtualId = `\0virtual-entry:${entryAbs}`;

  // vite config
  const createConfig = (): InlineConfig => ({
    plugins: [
      wrapEntryPlugin(virtualId, entryAbs, cssToInclude), // inject css import
      tailwindcss(),
      react(),
      // custom plugin to remove manualChunks - ensures single file
      {
        name: "remove-manual-chunks",
        outputOptions(options) {
          if ("manualChunks" in options) {
            delete (options as any).manualChunks;
          }
          return options;
        },
      },
    ],
    esbuild: {
      jsx: "automatic",
      jsxImportSource: "react",
      target: "es2022",
    },
    build: {
      target: "es2022",
      outDir,
      emptyOutDir: false,
      chunkSizeWarningLimit: 2000,
      minify: "esbuild",
      cssCodeSplit: false,
      rollupOptions: {
        input: virtualId,
        output: {
          format: "es",
          entryFileNames: `${name}.js`,
          inlineDynamicImports: true,
          assetFileNames: (info) =>
            (info.name || "").endsWith(".css")
              ? `${name}.css`
              : `[name]-[hash][extname]`,
        },
        preserveEntrySignatures: "allow-extension",
        treeshake: true,
      },
    },
  });

  // vite building
  console.group(`Building ${name} (react)`);
  await build(createConfig());
  console.groupEnd();
  builtNames.push(name);
  console.log(`Built ${name}`);
}

// get output files
const outputs = fs
  .readdirSync("assets")
  .filter((f) => f.endsWith(".js") || f.endsWith(".css"))
  .map((f) => path.join("assets", f))
  .filter((p) => fs.existsSync(p));

// hash & rename output files
const renamed = [];
const h = crypto
  .createHash("sha256")
  .update(pkg.version, "utf8")
  .digest("hex")
  .slice(0, 4);

console.group("Hashing outputs");
for (const out of outputs) {
  const dir = path.dirname(out);
  const ext = path.extname(out);
  const base = path.basename(out, ext);
  const newName = path.join(dir, `${base}-${h}${ext}`);

  if (!builtNames.includes(base)) {
    console.log(`Not from entries, skipping: ${out}`);
    renamed.push({ old: out, neu: out });
    continue;
  }

  fs.renameSync(out, newName);
  renamed.push({ old: out, neu: newName });
  console.log(`${out} -> ${newName}`);
}
console.groupEnd();
console.log("new hash: ", h);

// generate standalone html files
for (const name of builtNames) {
  const dir = outDir;
  const htmlPath = path.join(dir, `${name}-${h}.html`);
  const cssPath = path.join(dir, `${name}-${h}.css`);
  const jsPath = path.join(dir, `${name}-${h}.js`);

  const css = fs.existsSync(cssPath)
    ? fs.readFileSync(cssPath, { encoding: "utf8" })
    : "";
  const js = fs.existsSync(jsPath)
    ? fs.readFileSync(jsPath, { encoding: "utf8" })
    : "";

  const cssBlock = css ? `\n  <style>\n${css}\n  </style>\n` : "";
  const jsBlock = js ? `\n  <script type="module">\n${js}\n  </script>` : "";

  const html = [
    "<!doctype html>",
    "<html>",
    `<head>${cssBlock}</head>`,
    "<body>",
    `  <div id="${name}-root"></div>${jsBlock}`,
    "</body>",
    "</html>",
  ].join("\n");
  fs.writeFileSync(htmlPath, html, { encoding: "utf8" });
  console.log(`${htmlPath} (generated)`);
}
