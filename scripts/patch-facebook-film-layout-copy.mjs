import fs from 'node:fs';

function replaceOnce(text, oldText, newText, label) {
  const count = text.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label}: expected 1 anchor, found ${count}`);
  return text.replace(oldText, newText);
}

const landingPath='app/components/FilmLanding.tsx';
let landing=fs.readFileSync(landingPath,'utf8');

landing=replaceOnce(
  landing,
  '<span>Трейлер</span>',
  '<span>Трейлер үзэх</span>',
  'trailer label'
);

landing=replaceOnce(
  landing,
  '    <section className="detail-related" aria-labelledby="related-title">\n      <div className="detail-section-heading"><h2 id="related-title">Их үзсэн 3 кино</h2></div>\n',
  '    <section className="detail-related">\n',
  'related heading removal'
);

landing=replaceOnce(
  landing,
  '<div className="detail-section-heading"><h2 id="detail-packages-title">{category} киноны багц</h2></div>',
  '<div className="detail-section-heading"><h2 id="detail-packages-title">60 кино багц 8000 төгрөг</h2></div>',
  'package heading copy'
);

const relatedStart=landing.indexOf('    <section className="detail-related">');
const packageStart=landing.indexOf('    {packages.length > 0 && <section className="detail-packages"');
if (relatedStart < 0 || packageStart < 0 || relatedStart > packageStart) throw new Error('section order anchors not found');
const relatedEnd=landing.indexOf('    </section>\n\n', relatedStart);
if (relatedEnd < 0) throw new Error('related section end not found');
const relatedBlock=landing.slice(relatedStart, relatedEnd + '    </section>\n\n'.length);
const packageEnd=landing.indexOf('    </section>}\n', packageStart);
if (packageEnd < 0) throw new Error('package section end not found');
const packageBlock=landing.slice(packageStart, packageEnd + '    </section>}\n'.length);
const combinedEnd=packageStart + packageBlock.length;
landing = landing.slice(0, relatedStart) + packageBlock + '\n' + relatedBlock + landing.slice(combinedEnd);
fs.writeFileSync(landingPath, landing);

const testPath='tests/ui/movie-details.test.cjs';
let test=fs.readFileSync(testPath,'utf8');
test=replaceOnce(
  test,
  "assert.deepEqual([...document.querySelectorAll('.film-destination > section')].map(x=>x.className),['film-landing','detail-related','detail-packages']);",
  "assert.deepEqual([...document.querySelectorAll('.film-destination > section')].map(x=>x.className),['film-landing','detail-packages','detail-related']);",
  'section order assertion'
);
test=replaceOnce(
  test,
  "await render('/?film=7&fbclid=tracking');assert.deepEqual([...document.querySelectorAll('.related-film h3')].map(x=>x.textContent),['Салхи','Зам','Уул']);",
  "await render('/?film=7&fbclid=tracking');assert.deepEqual([...document.querySelectorAll('.related-film h3')].map(x=>x.textContent),['Салхи','Зам','Уул']);assert.equal(document.querySelector('.detail-play span').textContent,'Трейлер үзэх');assert.equal(document.querySelector('#related-title'),null);",
  'Facebook detail copy assertions'
);
test=replaceOnce(
  test,
  "await pop('/?film=34');assert.match(document.querySelector('#detail-packages-title').textContent,/Хятад/);assert.ok([...document.querySelectorAll('.detail-plan button')].every(x=>x.getAttribute('aria-label').startsWith('Хятад')));",
  "await pop('/?film=34');assert.equal(document.querySelector('#detail-packages-title').textContent,'60 кино багц 8000 төгрөг');assert.ok([...document.querySelectorAll('.detail-plan button')].every(x=>x.getAttribute('aria-label').startsWith('Хятад')));",
  'package heading assertion'
);
fs.writeFileSync(testPath,test);
console.log('Facebook film page layout and copy updated.');
