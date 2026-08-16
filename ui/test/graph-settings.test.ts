import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ATTENTION_EPISTEMIC,
  CURRENT_TRUTH_EPISTEMIC,
  DEFAULT_GRAPH_DISPLAY_OPTIONS,
  formatGraphCount,
  graphKnowledgeView,
  lensSettingsEdited,
  normalizeGraphDisplayOptions,
  scalePercent,
  toggleGraphEpistemicFacet,
} from '../src/graph-settings';
import { BUILTIN_LENSES } from '../src/lenses';

test('graph display settings migrate the old inverse label threshold', () => {
  const migrated = normalizeGraphDisplayOptions({
    labelThreshold: 0.75,
    nodeScale: 99,
    relationshipLabels: 'unexpected',
  });

  assert.equal(migrated.labelDensity, 2);
  assert.equal(migrated.nodeScale, 1.8);
  assert.equal(migrated.relationshipLabels, 'intent');
  assert.equal(migrated.linkScale, DEFAULT_GRAPH_DISPLAY_OPTIONS.linkScale);
});

test('lens edited state follows settings owned by the active lens', () => {
  const lens = BUILTIN_LENSES[0].settings;
  const active = {
    layout: lens.layout,
    color: lens.color,
    size: lens.size,
    docsOnly: lens.docsOnly,
    showDerivedAssociations: lens.showDerivedAssociations,
  };

  assert.equal(lensSettingsEdited(lens, active), false);
  assert.equal(lensSettingsEdited(lens, { ...active, size: 'betweenness' }), true);
});

test('visual scales use a compact percentage label', () => {
  assert.equal(scalePercent(1), '100%');
  assert.equal(scalePercent(1.25), '125%');
});

test('the knowledge view only marks a preset active when all of its filters match', () => {
  assert.equal(graphKnowledgeView(new Set(CURRENT_TRUTH_EPISTEMIC), false), 'current');
  assert.equal(graphKnowledgeView(new Set(['fact']), false), 'custom');
  assert.equal(graphKnowledgeView(new Set(['unclassified']), false), 'custom');
  assert.equal(graphKnowledgeView(new Set(CURRENT_TRUTH_EPISTEMIC), true), 'custom');
  assert.equal(graphKnowledgeView(new Set([
    ...CURRENT_TRUTH_EPISTEMIC,
    ...ATTENTION_EPISTEMIC,
  ]), true), 'evidence');
});

test('epistemic facets switch groups before adding or removing choices', () => {
  const unclassified = toggleGraphEpistemicFacet(
    new Set(CURRENT_TRUTH_EPISTEMIC),
    'unclassified',
    ATTENTION_EPISTEMIC,
    CURRENT_TRUTH_EPISTEMIC,
  );
  assert.deepEqual([...unclassified], ['unclassified']);

  const withContested = toggleGraphEpistemicFacet(
    unclassified,
    'contested',
    ATTENTION_EPISTEMIC,
    CURRENT_TRUTH_EPISTEMIC,
  );
  assert.deepEqual([...withContested], ['unclassified', 'contested']);
  assert.deepEqual(
    [...toggleGraphEpistemicFacet(unclassified, 'unclassified', ATTENTION_EPISTEMIC, CURRENT_TRUTH_EPISTEMIC)],
    CURRENT_TRUTH_EPISTEMIC,
  );
});

test('graph counts stay compact without hiding small exact values', () => {
  assert.equal(formatGraphCount(999), '999');
  assert.equal(formatGraphCount(2_359), '2.4k');
  assert.equal(formatGraphCount(12_400), '12k');
  assert.equal(formatGraphCount(1_250_000), '1.3m');
});
