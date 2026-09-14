import { test, expect } from '@playwright/test';

/**
 * Cockpit surfaces — every primary nav surface renders on an onboarded,
 * empty Pod. Assertions target surface-unique copy (empty states included).
 */
const SURFACES: Array<{ key: string; text: string | RegExp }> = [
  { key: 'activity', text: 'Give Pod something to remember' },
  { key: 'memories', text: 'No items match your filters' },
  { key: 'docs', text: 'Star a doc to pin it here.' },
  { key: 'journal', text: /one thing you noticed today/ },
  { key: 'skills', text: 'Your Capability Library is empty' },
  { key: 'connections', text: 'Manage what feeds Pod, what can use it, and which models are available.' },
];

for (const surface of SURFACES) {
  test(`${surface.key} surface renders`, async ({ page }) => {
    await page.goto('/');
    const nav = page.locator(`[data-nav="${surface.key}"]`);
    await nav.click();
    await expect(nav).toHaveClass(/active/);
    await expect(page.getByText(surface.text).first()).toBeVisible();
  });
}

test('Ask Pod panel opens, closes, and accepts input (no send)', async ({ page }) => {
  await page.goto('/');

  // Local-only guarantee: external requests are blocked and asserted empty
  // (the cockpit must not reach outside 127.0.0.1 during interactions).
  const external: string[] = [];
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
      external.push(url.href);
      return route.abort();
    }
    return route.continue();
  });

  const shell = page.locator('.app-body-wrap');
  const toggle = page.locator('.search-ai-btn');
  const input = page.locator('input[placeholder="Ask Pod..."]');

  // Panel opens via the topbar toggle (class signal — the panel stays in the
  // DOM when collapsed, so visibility is not a reliable state probe).
  await expect(shell).not.toHaveClass(/ai-chat-open/);
  await toggle.click();
  await expect(shell).toHaveClass(/ai-chat-open/);

  // Closes and re-opens
  await toggle.click();
  await expect(shell).not.toHaveClass(/ai-chat-open/);
  await toggle.click();
  await expect(shell).toHaveClass(/ai-chat-open/);

  // Accepts text (never submitted — no model calls from the suite)
  await input.fill('What happened yesterday?');
  await expect(input).toHaveValue('What happened yesterday?');

  expect(external, `external calls attempted: ${external.join(', ')}`).toEqual([]);
});
