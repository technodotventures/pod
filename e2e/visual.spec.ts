import { test, expect } from '@playwright/test';

/**
 * Visual snapshots — committed baselines for stable cockpit surfaces.
 * Baselines live next to this file under `visual.spec.ts-snapshots/`.
 * Refresh intentionally only: `npm run test:e2e:update`.
 */
const SHOTS: Array<{ key: string; name: string }> = [
  { key: 'activity', name: 'activity-empty.png' },
  { key: 'docs', name: 'docs-empty.png' },
  { key: 'connections', name: 'connections.png' },
];

for (const shot of SHOTS) {
  test(`visual — ${shot.key}`, async ({ page }) => {
    await page.goto('/');
    const nav = page.locator(`[data-nav="${shot.key}"]`);
    await nav.click();
    await expect(nav).toHaveClass(/active/);
    // Let fonts and the first paint settle before comparing.
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot(shot.name);
  });
}
