import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';

it('uses one configurable minimum height for the field and picker trigger', async () => {
  const css = await readFile(new URL('../src/mono.css', import.meta.url), 'utf8');

  expect(css).toMatch(/--lsp-control-size:\s*40px;/);
  expect(css).not.toMatch(/min-block-size:\s*40px;/);
  expect([...css.matchAll(/min-block-size:\s*var\(--lsp-control-size\);/g)].length).toBeGreaterThanOrEqual(2);
});
