import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { createCanvas, loadImage } from '@napi-rs/canvas';

test('macOS app icon is a full-size square tile without transparent gutters', async () => {
  const packageJson = JSON.parse(await readFile(path.resolve('package.json'), 'utf8')) as {
    build?: { mac?: { icon?: string } };
  };
  const iconPath = packageJson.build?.mac?.icon;

  assert.equal(iconPath, 'ui/public/brand/pod-icon-tile.png');

  const image = await loadImage(path.resolve(iconPath));
  assert.equal(image.width, 1024);
  assert.equal(image.height, 1024);

  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, image.width, image.height).data;

  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const alpha = pixels[(y * image.width + x) * 4 + 3];
      if (alpha === 0) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  assert.deepEqual([minX, minY, maxX, maxY], [0, 0, image.width - 1, image.height - 1]);
});
