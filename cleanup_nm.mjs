import fs from 'fs';
import path from 'path';

// npm temp dirs look like: .packagename-XXXXXXXX (8+ char random suffix)
const npmTempPattern = /^\.[a-zA-Z0-9@].*-[A-Za-z0-9]{8,}$/;

function cleanTempDirs(dir, depth = 0) {
  if (depth > 8) return 0;
  let count = 0;
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch(e) {
    return 0;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry);
    let stat;
    try { stat = fs.lstatSync(full); } catch(e) { continue; }
    if (!stat.isDirectory()) continue;

    if (npmTempPattern.test(entry)) {
      try {
        fs.rmSync(full, { recursive: true, force: true });
        count++;
        console.log('removed', full);
      } catch(e) {
        console.error('failed', full, e.message);
      }
    } else {
      count += cleanTempDirs(full, depth + 1);
    }
  }
  return count;
}

const nm = '/tmp/cc-agent/67937108/project/node_modules';
const total = cleanTempDirs(nm);
console.log('done, removed', total, 'dirs');
