import { test, expect } from '@playwright/test';

/**
 * Capabilities layout — regression guard (run 007 review fix).
 *
 * The card footers must keep every chip INSIDE the tile box. The pre-fix
 * footer was a nowrap flex row, so the added freshness/count/trust/deploy
 * chips spilled up to ~250px past the card edge (caught in review, not by
 * the gates). This spec seeds one Skill through the review cycle via the
 * local API (dev instance, no token) and asserts containment geometrically
 * for every footer chip on the seeded card.
 */

const API = `http://127.0.0.1:${process.env.COFFEE_POD_PORT ?? 8907}`;
const SLUG = 'layout-guard-skill';

function skillFiles(version: string, extra = false): Record<string, string> {
  const files: Record<string, string> = {
    'SKILL.md': `# ${version}\n`,
    'reference/a.md': 'a\n',
    'reference/b.md': 'b\n',
  };
  if (extra) files['reference/c.md'] = 'c\n';
  return files;
}

test('capability card chips stay within the tile', async ({ page, request }) => {
  // Seed: r1 approved, then r2 pending (widest chip set on the Library card).
  const create = await request.post(`${API}/pod/skills`, {
    data: {
      actor_id: 'person-local', name: 'Layout Guard Skill',
      description: 'Layout regression fixture.', version: '1.0.0', author: 'e2e',
      source: 'manual', source_slug: SLUG, files: skillFiles('v1', true),
    },
  });
  expect(create.ok()).toBeTruthy();

  const list = await (await request.get(`${API}/pod/skills`)).json();
  const skill = list.skills.find((s: any) => s.source_slug === SLUG);
  expect(skill, 'seeded skill present').toBeTruthy();
  const r1 = skill.revisions.find((r: any) => r.revision_number === 1);

  const approve = await request.post(`${API}/pod/skills/${skill.id}/revisions/${r1.id}/approve`, {
    data: { actor_id: 'person-local' },
  });
  expect(approve.ok()).toBeTruthy();

  const second = await request.post(`${API}/pod/skills`, {
    data: {
      actor_id: 'person-local', name: 'Layout Guard Skill', source: 'manual', source_slug: SLUG,
      files: skillFiles('v2'),
    },
  });
  expect(second.ok()).toBeTruthy();

  // Verify through the UI.
  await page.goto('/');
  const nav = page.locator('[data-nav="skills"]');
  await nav.click();
  await expect(nav).toHaveClass(/active/);
  await page.getByRole('button', { name: 'Library' }).first().click();

  const tile = page.locator('.skill-tile', { hasText: 'Layout Guard Skill' }).first();
  await expect(tile).toBeVisible();

  const tileBox = await tile.boundingBox();
  expect(tileBox, 'tile has a box').not.toBeNull();

  const chips = tile.locator('.skill-tile-footer > *');
  const count = await chips.count();
  expect(count, 'seeded card exposes the full chip row').toBeGreaterThan(3);

  for (let i = 0; i < count; i++) {
    const chipBox = await chips.nth(i).boundingBox();
    if (!chipBox || !tileBox) continue;
    expect(chipBox.x + chipBox.width, `chip ${i} overflows the tile's right edge`).toBeLessThanOrEqual(tileBox.x + tileBox.width + 1);
    expect(chipBox.y + chipBox.height, `chip ${i} overflows the tile's bottom edge`).toBeLessThanOrEqual(tileBox.y + tileBox.height + 1);
    expect(chipBox.x, `chip ${i} spills left of the tile`).toBeGreaterThanOrEqual(tileBox.x - 1);
  }
});
