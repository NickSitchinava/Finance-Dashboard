import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/invoiceSignature.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { normalizeSignature, signatureBounds, signatureSvg } = await import(`data:text/javascript,${encodeURIComponent(compiled)}`);

test('multiple saved strokes render in one cropped transparent SVG', () => {
  const signature = normalizeSignature({ version: 1, strokes: [
    [{ x: 30, y: 50, w: 2 }, { x: 60, y: 55, w: 3 }],
    [{ x: 75, y: 60, w: 2 }, { x: 90, y: 62, w: 2 }],
  ] });
  assert.equal(signature.strokes.length, 2);
  const bounds = signatureBounds(signature);
  assert.ok(bounds.width < 300 && bounds.height < 180);
  const svg = signatureSvg(signature);
  assert.equal((svg.match(/<path /g) || []).length, 2);
  assert.match(svg, /fill="none"/);
  assert.match(svg, /stroke-width="2\.50"/);
});

test('invalid or empty signature data is not displayed', () => {
  assert.equal(normalizeSignature({ version: 1, strokes: [] }), null);
  assert.equal(normalizeSignature({ version: 1, strokes: [[{ x: 'bad', y: 3, w: 2 }]] }), null);
  assert.equal(signatureSvg(null), null);
});
