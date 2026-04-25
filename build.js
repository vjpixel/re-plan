// Regenerates the auto-generated regions of insert-sprint.gs from parser.js.
//
// Apps Script does not import Node modules, so insert-sprint.gs needs its own
// copy of any pure parser helper that runs server-side. This script keeps that
// copy in sync: it reads named functions from parser.js (stripping the
// module.exports line) and replaces the region between the BEGIN/END markers
// in insert-sprint.gs.
//
// Usage:
//   node build.js          → rewrite insert-sprint.gs in place if it drifted
//   node build.js --check  → exit 1 if it would change anything (CI guard)

const fs = require('fs');
const path = require('path');

const PARSER_PATH = path.join(__dirname, 'parser.js');
const TARGET_PATH = path.join(__dirname, 'insert-sprint.gs');
const FUNCTIONS_TO_INLINE = ['parseInlineBold'];

const BEGIN_MARKER = '// ===== BEGIN auto-generated from parser.js =====';
const END_MARKER = '// ===== END auto-generated from parser.js =====';

function extractFunction(source, name) {
  const sig = `function ${name}(`;
  const sigIdx = source.indexOf(sig);
  if (sigIdx === -1) {
    throw new Error(`Function "${name}" not found in parser.js`);
  }
  // Walk back over a contiguous block of "//" line comments (the doc block).
  let commentStart = sigIdx;
  let cursor = sigIdx - 1;
  while (cursor >= 0) {
    const lineEnd = cursor;
    while (cursor >= 0 && source[cursor] !== '\n') cursor--;
    const line = source.slice(cursor + 1, lineEnd + 1);
    if (line.trim().startsWith('//')) {
      commentStart = cursor + 1;
      cursor--;
    } else {
      break;
    }
  }
  // Walk forward to find the matching closing brace.
  let braceOpen = source.indexOf('{', sigIdx);
  let depth = 1;
  let i = braceOpen + 1;
  while (i < source.length && depth > 0) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') depth--;
    i++;
  }
  if (depth !== 0) {
    throw new Error(`Unbalanced braces in function "${name}"`);
  }
  return source.slice(commentStart, i);
}

function build({ check }) {
  const parser = fs.readFileSync(PARSER_PATH, 'utf8');
  const target = fs.readFileSync(TARGET_PATH, 'utf8');

  const beginIdx = target.indexOf(BEGIN_MARKER);
  const endIdx = target.indexOf(END_MARKER);
  if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) {
    throw new Error(
      `Markers not found in ${TARGET_PATH}. Expected:\n  ${BEGIN_MARKER}\n  ${END_MARKER}`
    );
  }

  const blocks = FUNCTIONS_TO_INLINE.map((name) => extractFunction(parser, name));
  const generated = blocks.join('\n\n');
  const replacement =
    `${BEGIN_MARKER}\n` +
    `// Do not edit by hand — run "npm run build" to regenerate from parser.js.\n` +
    `${generated}\n` +
    `${END_MARKER}`;

  const updated =
    target.slice(0, beginIdx) +
    replacement +
    target.slice(endIdx + END_MARKER.length);

  if (updated === target) {
    console.log(`${path.basename(TARGET_PATH)} is in sync with parser.js.`);
    return;
  }

  if (check) {
    console.error(
      `${path.basename(TARGET_PATH)} is OUT OF SYNC with parser.js. Run "npm run build".`
    );
    process.exit(1);
  }

  fs.writeFileSync(TARGET_PATH, updated);
  console.log(`Updated ${path.basename(TARGET_PATH)}.`);
}

build({ check: process.argv.includes('--check') });
