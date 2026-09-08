const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(projectRoot, 'drizzle');
const targetDir = path.join(projectRoot, 'dist', 'server', 'migrations');

if (!fs.existsSync(path.join(projectRoot, 'dist', 'server', 'wrangler.json'))) {
  throw new Error('Compile o projeto antes de aplicar as migrações locais.');
}

fs.mkdirSync(targetDir, { recursive: true });
for (const fileName of fs.readdirSync(sourceDir).filter((name) => name.endsWith('.sql'))) {
  fs.copyFileSync(path.join(sourceDir, fileName), path.join(targetDir, fileName));
}

console.log('Migrações locais preparadas.');
