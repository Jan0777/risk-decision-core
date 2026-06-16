import fs from 'fs';

let code = fs.readFileSync('./src/pages/admin/WhatIfEditor.tsx', 'utf8');

code = code.replace(/POLICY_OPTIMIZED_INDIRECT_USED_AUTO\.gates/g, 'basePolicy.gates');

fs.writeFileSync('./src/pages/admin/WhatIfEditor.tsx', code, 'utf8');
