import { readFileSync } from 'node:fs';

const pkgPath = new URL('../package.json', import.meta.url);
const manifestPath = new URL('../manifest.json', import.meta.url);

try {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

  if (pkg.version !== manifest.version) {
    console.error(`❌ Version mismatch!`);
    console.error(`  package.json:  ${pkg.version}`);
    console.error(`  manifest.json: ${manifest.version}`);
    process.exit(1);
  }

  console.log(`✅ Versions match: ${pkg.version}`);
} catch (error) {
  console.error(`❌ Error checking versions:`, error.message);
  process.exit(1);
}
