import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';

// Read package.json to get name and version
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));
const { name, version } = packageJson;

const zipFileName = `${name}-v${version}.zip`;
const outputDir = 'dist';

console.log(`📦 Packaging extension into ${zipFileName}...`);

try {
  // Get all files and folders in dist/ to archive them individually
  // This avoids including the "." folder entry in the zip file
  const files = readdirSync(outputDir);

  // Use execFileSync with an args array to avoid shell injection
  execFileSync('tar', ['-a', '-cf', `../${zipFileName}`, ...files], {
    cwd: outputDir,
    stdio: 'inherit',
  });
  console.log(`✅ Successfully created ${zipFileName}`);
} catch (error) {
  console.error('❌ Failed to create zip file:', error.message);
  process.exit(1);
}
