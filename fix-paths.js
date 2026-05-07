const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, 'dist');
const indexPath = path.join(distPath, 'index.html');
const nojekyllPath = path.join(distPath, '.nojekyll');

// Create .nojekyll
fs.writeFileSync(nojekyllPath, '');
console.log('Created .nojekyll');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

function fixPathsInFile(filePath) {
  const ext = path.extname(filePath);
  if (['.html', '.js', '.css', '.json'].includes(ext)) {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    
    // Replace absolute paths with relative-to-repo paths
    // Look for patterns like "/assets/", "/_expo/", etc.
    // We avoid replacing just "/" to not break logic, but focus on known asset prefixes
    content = content.replace(/(["'])\/assets\//g, '$1/customerstracker/assets/');
    content = content.replace(/(["'])\/_expo\//g, '$1/customerstracker/_expo/');
    
    // Specifically for index.html links/scripts
    if (ext === '.html') {
      content = content.replace(/src="\//g, 'src="/customerstracker/');
      content = content.replace(/href="\//g, 'href="/customerstracker/');
    }

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content);
      console.log(`Fixed paths in: ${path.relative(distPath, filePath)}`);
    }
  }
}

if (fs.existsSync(distPath)) {
  walkDir(distPath, (filePath) => {
    fixPathsInFile(filePath);
  });
  console.log('Successfully fixed paths for GitHub Pages deployment');
} else {
  console.error('dist directory not found. Please run "npx expo export --platform web" first.');
  process.exit(1);
}
