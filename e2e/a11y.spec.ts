import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility gate — zero critical violations on the primary surfaces
 * (WCAG 2.0/2.1 A+AA rulesets). Lower-impact findings are attached as an
 * artifact for review; only `critical` blocks the suite.
 */
const SURFACES = ['activity', 'memories', 'docs', 'journal', 'skills', 'connections'];

for (const key of SURFACES) {
  test(`${key} — no critical a11y violations`, async ({ page }, testInfo) => {
    await page.goto('/');
    const nav = page.locator(`[data-nav="${key}"]`);
    await nav.click();
    await expect(nav).toHaveClass(/active/);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    await testInfo.attach(`axe-${key}`, {
      body: JSON.stringify(results.violations, null, 1),
      contentType: 'application/json',
    });

    const critical = results.violations.filter((violation) => violation.impact === 'critical');
    expect(
      critical,
      JSON.stringify(critical.map((v) => ({ id: v.id, nodes: v.nodes.length })), null, 1),
    ).toEqual([]);
  });
}
