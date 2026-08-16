import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ACTIVITY_PRESENT_GAP,
  activityTimelineColorAt,
  computeActivityTimelineLayout,
} from '../src/activity-layout';

test('Present stays next to the newest card after real card heights are measured', () => {
  const layout = computeActivityTimelineLayout([82, 104, 96, 88, 110, 92]);

  assert.equal(
    layout.rulerHeight - layout.lastCardBottom,
    ACTIVITY_PRESENT_GAP,
  );
});

test('activity colour follows the nearest card and blends between neighbours', () => {
  const stops = [
    { position: 100, color: '#ff0000' },
    { position: 300, color: '#0000ff' },
  ];

  assert.equal(activityTimelineColorAt(stops, 50), '#ff0000');
  assert.equal(activityTimelineColorAt(stops, 100), '#ff0000');
  assert.equal(activityTimelineColorAt(stops, 200), '#800080');
  assert.equal(activityTimelineColorAt(stops, 250), '#4000bf');
  assert.equal(activityTimelineColorAt(stops, 300), '#0000ff');
  assert.equal(activityTimelineColorAt(stops, 400), '#0000ff');
});

test('activity colour gracefully ignores invalid stops', () => {
  assert.equal(
    activityTimelineColorAt([{ position: 100, color: 'not-a-colour' }], 100, '#123456'),
    '#123456',
  );
});
