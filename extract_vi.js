const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'apps', 'frontend', 'src', 'app', 'dashboard');

// Regex to find Vietnamese characters in text
// Vietnamese characters: àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ etc.
const viRegex = /["'][^"']*[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ][^"']*["']/gi;
// And regex for JSX text: >Vietnamese text<
const jsxViRegex = />[^<]*[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ][^<]*</gi;

const results = new Set();

function walk(currentDir) {
  const files = fs.readdirSync(currentDir);
  for (const file of files) {
    const fullPath = path.join(currentDir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      
      // Extract string literals
      let match;
      while ((match = viRegex.exec(content)) !== null) {
        let str = match[0].slice(1, -1).trim();
        if (str) results.add(str);
      }
      
      // Extract JSX text
      while ((match = jsxViRegex.exec(content)) !== null) {
        let str = match[0].slice(1, -1).trim();
        // Remove braces if any
        str = str.replace(/[{}]/g, '').trim();
        if (str) results.add(str);
      }
    }
  }
}

walk(dir);

console.log(JSON.stringify(Array.from(results).sort(), null, 2));
