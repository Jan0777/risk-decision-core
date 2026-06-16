const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
const analyzeRegex = /app\.post\("\/api\/chat\/analyze", async \(req, res\) => \{[\s\S]*?\n\}\);\n/;
code = code.replace(analyzeRegex, '');
fs.writeFileSync('server.ts', code);
