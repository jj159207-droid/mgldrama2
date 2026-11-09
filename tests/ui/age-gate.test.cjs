const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const repo = path.resolve(__dirname, '../..');
const appDir = path.join(repo, 'app');

function sourceFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(fullPath));
    else if (/\.(?:tsx?|jsx?|css)$/.test(entry.name)) files.push(fullPath);
  }
  return files;
}

test('visitors can load TAZA routes directly without any 21+ confirmation wrapper', () => {
  const layout = fs.readFileSync(path.join(appDir, 'layout.tsx'), 'utf8');
  assert.match(layout, /\{children\}/);
  assert.match(layout, /<CinematicHeroMount \/>/);
  assert.match(layout, /<CatalogCardTuning \/>/);
  assert.doesNotMatch(layout, /AgeGate|age-gate-title|taza_age_21/);
});

test('no age confirmation prompt or session-based age gate remains anywhere in the app', () => {
  assert.equal(fs.existsSync(path.join(appDir, 'components', 'AgeGate.tsx')), false);
  for (const filePath of sourceFiles(appDir)) {
    const source = fs.readFileSync(filePath, 'utf8');
    assert.doesNotMatch(source, /AgeGate|Та 21 нас хүрсэн үү\?|taza_age_21_session_v2/,
      'Unexpected age gate found in ' + path.relative(repo, filePath));
  }
});
