const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'apps', 'frontend', 'src', 'app', 'dashboard');

// Matches lines containing at least one Vietnamese character
const viCharRegex = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

const outputLines = [];

function walk(currentDir) {
  const files = fs.readdirSync(currentDir);
  for (const file of files) {
    const fullPath = path.join(currentDir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      const matchingLines = [];
      
      lines.forEach((line, index) => {
        if (viCharRegex.test(line)) {
          matchingLines.push({ lineNum: index + 1, text: line.trim() });
        }
      });
      
      if (matchingLines.length > 0) {
        outputLines.push(`FILE: ${path.relative(__dirname, fullPath)}`);
        matchingLines.forEach(l => {
          outputLines.push(`  L${l.lineNum}: ${l.text}`);
        });
        outputLines.push('');
      }
    }
  }
}

walk(dir);

fs.writeFileSync(path.join(__dirname, 'vi_lines.txt'), outputLines.join('\n'), 'utf8');
console.log('Done writing to vi_lines.txt');
