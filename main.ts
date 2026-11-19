import { cpSync, mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

function packageGuide(destination: string) {
  const source = fileURLToPath(new URL('.', import.meta.url));
  const target = resolve(destination);
  if (target === resolve(source) || resolve(source).startsWith(target + '/')) {
    throw new Error('Output must not contain the source repository.');
  }
  for (const protectedName of ['app', 'screenshots', 'vendor', '.git']) {
    const protectedPath = resolve(source, protectedName);
    if (target === protectedPath || target.startsWith(protectedPath + '/')) {
      throw new Error('Output must not overwrite a source directory.');
    }
  }
  mkdirSync(target, { recursive: true });
  for (const directory of ['app', 'screenshots']) {
    const input = join(source, directory);
    readdirSync(input); // Fail before packaging if a required directory is absent.
    rmSync(join(target, directory), { recursive: true, force: true });
    cpSync(input, join(target, directory), { recursive: true, dereference: false });
  }
  const dossier = buildDossier(target, {
    text_max_bytes: 163840,
    app_max_files: 993,
    app_max_bytes: 48 * 1024 * 1024,
    screenshots: { max: 4, max_bytes: 256 * 1024 },
  });
  writeFileSync(join(target, 'dossier.json'), dossier);
}

packageGuide(process.env.MAKEFUN_OUTPUT_DIR || '/output');
