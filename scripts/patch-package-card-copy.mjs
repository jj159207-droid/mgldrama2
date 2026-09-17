import fs from 'node:fs';

function replaceOnce(text, oldText, newText, label) {
  const count = text.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label}: expected 1 anchor, found ${count}`);
  return text.replace(oldText, newText);
}

const landingPath = 'app/components/FilmLanding.tsx';
let landing = fs.readFileSync(landingPath, 'utf8');
landing = replaceOnce(
  landing,
  '    {packages.length > 0 && <section className="detail-packages" aria-labelledby="detail-packages-title">\n      <div className="detail-section-heading"><h2 id="detail-packages-title">60 кино багц 8000 төгрөг</h2></div>\n',
  '    {packages.length > 0 && <section className="detail-packages" aria-label="Киноны багц">\n',
  'remove package heading'
);
landing = replaceOnce(
  landing,
  '</svg><h3>{plan.days} хоног</h3>',
  '</svg><span className="eyebrow">60 кино үзэх эрх</span><h3>{plan.days} хоног</h3>',
  'package card access label'
);
fs.writeFileSync(landingPath, landing);

const testPath = 'tests/ui/movie-details.test.cjs';
let test = fs.readFileSync(testPath, 'utf8');
test = replaceOnce(
  test,
  "await pop('/?film=34');assert.equal(document.querySelector('#detail-packages-title').textContent,'60 кино багц 8000 төгрөг');assert.ok([...document.querySelectorAll('.detail-plan button')].every(x=>x.getAttribute('aria-label').startsWith('Хятад')));",
  "await pop('/?film=34');assert.equal(document.querySelector('#detail-packages-title'),null);assert.deepEqual([...document.querySelectorAll('.detail-plan .eyebrow')].map(x=>x.textContent),['60 кино үзэх эрх','60 кино үзэх эрх']);assert.ok([...document.querySelectorAll('.detail-plan button')].every(x=>x.getAttribute('aria-label').startsWith('Хятад')));",
  'package copy assertion'
);
fs.writeFileSync(testPath, test);
console.log('Package heading removed and 60-movie access labels added to both cards.');
