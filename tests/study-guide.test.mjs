import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { renderStudyGuide } from '../web/study-guide.js';

test('guide gives a starting article, a full sequence and explicit topics to defer', () => {
 const html = renderStudyGuide('../../');
 assert.match(html, /Comece por aqui/);
 assert.match(html, /Deixe para depois/);
 assert.match(html, /identidade-gerenciada-defaultazurecredential/);
 const links=[...html.matchAll(/href="\.\.\/\.\.\/(chapters\/[^"#]+)"/g)];
 assert.ok(links.length>=9);
 for(const [,link] of links)assert.ok(existsSync(link.replace(/\/index.html$/, '.md')),link);
});
