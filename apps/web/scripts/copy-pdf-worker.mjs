import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, '..');
const source = resolve(appRoot, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
const targetDir = resolve(appRoot, 'public');
const target = resolve(targetDir, 'pdf.worker.min.mjs');

await mkdir(targetDir, { recursive: true });
await copyFile(source, target);
console.log(`Copied PDF.js worker → ${target}`);
