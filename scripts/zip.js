import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Read package.json to get name and version
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));
const { name, version } = packageJson;

const zipFileName = `${name}-v${version}.zip`;
const outputDir = 'dist';

console.log(`📋 Copying manifest.json to ${outputDir}...`);
try {
  const manifest = readFileSync(new URL('../manifest.json', import.meta.url), 'utf-8');
  writeFileSync(join(outputDir, 'manifest.json'), manifest);
} catch (error) {
  console.error('⚠️ Could not copy manifest.json via Node:', error.message);
}

console.log(`📦 Packaging extension into ${zipFileName}...`);

try {
  // Get all files and folders in dist/ to archive them individually
  // This avoids including the "." folder entry in the zip file
  const files = readdirSync(outputDir);
  const filesList = files.map(f => `"${f}"`).join(' ');

  execSync(`tar -a -cf ../${zipFileName} ${filesList}`, { 
    cwd: outputDir, 
    stdio: 'inherit' 
  });
  console.log(`✅ Successfully created ${zipFileName}`);
} catch (error) {
  console.error('❌ Failed to create zip file:', error.message);
  process.exit(1);
}
