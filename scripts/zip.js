import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Read package.json to get name and version
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));
const { name, version } = packageJson;

const zipFileName = `${name}-v${version}.zip`;
const outputDir = 'dist';

console.log(`📦 Packaging extension into ${zipFileName}...`);

try {
  // Use tar to create the zip file from the contents of the dist directory
  // -a automatically determines compression based on extension (.zip)
  // -c creates a new archive
  // -f specifies the filename
  // The command is run inside the 'dist' directory to avoid including the 'dist/' prefix in the zip.
  execSync(`tar -a -cf ../${zipFileName} .`, { 
    cwd: outputDir, 
    stdio: 'inherit' 
  });
  console.log(`✅ Successfully created ${zipFileName}`);
} catch (error) {
  console.error('❌ Failed to create zip file:', error.message);
  process.exit(1);
}
