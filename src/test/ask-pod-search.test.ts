import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';

import {
  meaningfulSearchTerms,
  parseTemporalHint,
  searchPodObjects,
  type TemporalRange,
} from '../services/ask-pod-search.js';

function objectDatabase(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE objects (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL DEFAULT 'page',
      title TEXT NOT NULL,
      summary TEXT,
      content TEXT,
      metadata TEXT,
      created_at TEXT,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      archived_at TEXT
    )
  `);
  return db;
}

test('Ask Pod object search ignores conversational filler instead of returning unrelated docs', () => {
  const db = objectDatabase();
  try {
    db.prepare(`
      INSERT INTO objects (id, title, summary, content, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      'market-research',
      'Coffee client workspace market research',
      'Notes from my workspace',
      'What is working in the client market?',
      '2026-07-26T09:00:00.000Z',
    );

    assert.deepEqual(
      meaningfulSearchTerms('What is my favourite colour?'),
      ['favourite', 'colour'],
    );
    assert.deepEqual(searchPodObjects(db, 'What is my favourite colour?'), []);
  } finally {
    db.close();
  }
});

test('Ask Pod does not let "any" turn a conflict-status question into a broad document search', () => {
  const db = objectDatabase();
  try {
    db.prepare(`
      INSERT INTO objects (id, title, summary, content, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      'unrelated-email',
      'Your updated plan',
      'You can cancel at any time.',
      'This is an ordinary subscription email.',
      '2026-07-26T09:00:00.000Z',
    );

    assert.deepEqual(
      meaningfulSearchTerms('Are there any conflicting memories?'),
      ['conflicting', 'memories'],
    );
    assert.deepEqual(
      searchPodObjects(db, 'Are there any conflicting memories?'),
      [],
    );
  } finally {
    db.close();
  }
});

test('Ask Pod treats a pure temporal question as a date filter', () => {
  const db = objectDatabase();
  const yesterday: TemporalRange = {
    start: '2026-07-25T00:00:00.000Z',
    end: '2026-07-26T00:00:00.000Z',
    label: 'yesterday',
  };
  try {
    db.prepare(`
      INSERT INTO objects (id, kind, title, summary, content, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'planning-notes',
      'calendar_event',
      'Planning notes',
      'Agreed the launch sequence.',
      JSON.stringify({ text: 'The team reviewed launch dependencies.', start: '2026-07-25T09:00:00.000Z' }),
      JSON.stringify({ start: '2026-07-25T09:00:00.000Z', end: '2026-07-25T10:00:00.000Z' }),
      '2026-07-26T09:00:00.000Z',
      '2026-07-27T09:00:00.000Z',
    );

    assert.deepEqual(
      meaningfulSearchTerms('What happened yesterday?', yesterday),
      [],
    );
    const matches = searchPodObjects(db, 'What happened yesterday?', {
      temporalRange: yesterday,
    });
    assert.deepEqual(matches.map(object => object.id), ['planning-notes']);
    assert.equal(matches[0]?.temporal_basis, 'valid_time');
    assert.deepEqual(matches[0]?.content, {
      text: 'The team reviewed launch dependencies.',
      start: '2026-07-25T09:00:00.000Z',
    });
  } finally {
    db.close();
  }
});

test('Ask Pod does not confuse artifact edits with represented-world time', () => {
  const db = objectDatabase();
  const yesterday: TemporalRange = {
    start: '2026-07-25T00:00:00.000Z',
    end: '2026-07-26T00:00:00.000Z',
    label: 'yesterday',
  };
  try {
    db.prepare(`
      INSERT INTO objects (id, kind, title, summary, content, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'old-meeting-edited-today',
      'calendar_event',
      'Old meeting',
      'A meeting from last month.',
      JSON.stringify({ start: '2026-06-01T09:00:00.000Z' }),
      JSON.stringify({ start: '2026-06-01T09:00:00.000Z', end: '2026-06-01T10:00:00.000Z' }),
      '2026-06-01T08:00:00.000Z',
      '2026-07-25T09:00:00.000Z',
    );

    assert.deepEqual(
      searchPodObjects(db, 'What happened yesterday?', { temporalRange: yesterday }),
      [],
    );
  } finally {
    db.close();
  }
});

test('Ask Pod interprets last week as the previous calendar week', () => {
  const range = parseTemporalHint(
    'What happened last week?',
    new Date(2026, 6, 29, 12, 0, 0),
  );

  assert.deepEqual(range, {
    start: new Date(2026, 6, 19, 0, 0, 0).toISOString(),
    end: new Date(2026, 6, 26, 0, 0, 0).toISOString(),
    label: 'last week',
  });
});
