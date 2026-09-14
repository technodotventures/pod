import { test, expect } from '@playwright/test';

/**
 * First-run journey (setup project). A fresh Pod shows the onboarding wizard;
 * "Set up later" completes setup and lands in the cockpit. Every other project
 * depends on this one, so the rest of the suite starts from an onboarded Pod.
 */
test('first-run onboarding — wizard renders; "Set up later" lands in the cockpit', async ({ page }) => {
  await page.goto('/');

  // Wizard, step 1 of 6
  await expect(page.getByText('One place for your memories to live and grow.')).toBeVisible();
  await expect(page.getByText('1 OF 6')).toBeVisible();
  const skip = page.getByRole('button', { name: 'Set up later' });
  await expect(skip).toBeVisible();

  await skip.click();

  // Cockpit shell: sidebar nav, pod identity, first surface content
  await expect(page.locator('[data-nav="activity"]')).toBeVisible();
  await expect(page.getByText('E2E Pod').first()).toBeVisible();
  await expect(page.getByText('Give Pod something to remember')).toBeVisible();
});
