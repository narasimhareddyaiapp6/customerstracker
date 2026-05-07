const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'dist', 'index.html');
const nojekyllPath = path.join(__dirname, 'dist', '.nojekyll');

// Create .nojekyll
fs.writeFileSync(nojekyllPath, '');

if (fs.existsSync(indexPath)) {
  let content = fs.readFileSync(indexPath, 'utf8');
  content = content.replace(/src="\//g, 'src="/customerstracker/');
  content = content.replace(/href="\//g, 'href="/customerstracker/');
  fs.writeFileSync(indexPath, content);
  console.log('Successfully fixed paths in dist/index.html');
} else {
  console.error('dist/index.html not found');
  process.exit(1);
}
