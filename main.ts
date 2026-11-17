// Prism Break's entrypoint (Node 22, standard library only). The game is
// this directory's game/ folder: plain static files a desktop browser
// loads offline (game/index.html and its ES modules, no library, no
// network request). This program hands the game in: it copies game/ and
// screenshots/ from beside this file to /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored
// make.fun library. It also prints a small build inventory of the game
// sources (added for this entry) so a plain run shows what was built.
//
// Serve the game locally with `node serve.ts`, then open
// http://localhost:8080. Outside the grader's container,
// MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** One line per game source file: its path, line count and byte size. */
function printInventory(root: string): void {
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(html|css|js|mjs|json)$/.test(entry.name)) files.push(full);
    }
  };
  walk(root);
  files.sort();
  let totalLines = 0;
  let totalBytes = 0;
  console.log('Prism Break build inventory:');
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const lines = text.split('\n').length;
    const bytes = statSync(file).size;
    totalLines += lines;
    totalBytes += bytes;
    console.log(`  ${relative(root, file)}  ${lines} lines  ${bytes} bytes`);
  }
  console.log(`  total: ${files.length} source files, ${totalLines} lines, ${totalBytes} bytes`);
}

printInventory(join(here, 'game'));

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes
// the bytes; the others refuse an entry the scorer would refuse (more
// than 4 screenshots or one over 256 KiB; more than 993 files in game/ or
// 48 MiB of game files in all, or a path under game/ over 1000 bytes).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
