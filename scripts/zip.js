import { createWriteStream, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import archiver from 'archiver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json to get name and version
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));
const { name, version } = packageJson;

const zipFileName = `${name}-v${version}.zip`;
const outputDir = join(__dirname, '../dist');
const zipFilePath = join(__dirname, '..', zipFileName);

console.log(`📦 Packaging extension into ${zipFileName}...`);

// Create a file to stream archive data to.
const output = createWriteStream(zipFilePath);
const archive = archiver('zip', {
  zlib: { level: 9 } // Sets the compression level.
});

// Listen for all archive data to be written
output.on('close', () => {
  console.log(`✅ Successfully created ${zipFileName} (${archive.pointer()} total bytes)`);
});

// Catch warnings (ie stat failures and other non-blocking errors)
archive.on('warning', (err) => {
  if (err.code === 'ENOENT') {
    console.warn('⚠️ Archive warning:', err);
  } else {
    throw err;
  }
});

// Catch errors
archive.on('error', (err) => {
  throw err;
});

// Pipe archive data to the file
archive.pipe(output);

// Append files from dist directory, putting its contents at the root of archive
archive.directory(outputDir, false);

// Finalize the archive (ie we are done appending files but streams have to finish yet)
await archive.finalize();
