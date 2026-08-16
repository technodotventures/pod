#!/usr/bin/env node
/**
 * Seed a deterministic, removable Space Exploration corpus for graph stress tests.
 *
 * The corpus is deliberately synthetic and stays in the Pod object graph. It does
 * not write observations or claims into Smartware's semantic memory.
 *
 *   node scripts/seed-space-exploration.mjs
 *   node scripts/seed-space-exploration.mjs --objects=4500
 *   node scripts/seed-space-exploration.mjs --reset --objects=4500
 *   node scripts/seed-space-exploration.mjs --remove
 *   COFFEE_POD_DATA_DIR=/path/to/data node scripts/seed-space-exploration.mjs
 */
import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SEED = 'space-exploration-stress-v1';
const DEFAULT_OBJECT_COUNT = 4_500;
const MIN_OBJECT_COUNT = 350;
const MAX_OBJECT_COUNT = 10_000;

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const dataDir = process.env.COFFEE_POD_DATA_DIR ?? path.join(root, 'data');
const dbPath = path.join(dataDir, 'pod.db');

const hasFlag = (flag) => process.argv.includes(flag);
const readNumberOption = (name, fallback) => {
  const prefix = `${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  if (raw === undefined) return fallback;
  if (!/^\d+$/.test(raw)) {
    throw new Error(`${name} must be a whole number.`);
  }
  return Number(raw);
};

let requestedObjectCount;
try {
  requestedObjectCount = readNumberOption('--objects', DEFAULT_OBJECT_COUNT);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

if (requestedObjectCount < MIN_OBJECT_COUNT || requestedObjectCount > MAX_OBJECT_COUNT) {
  console.error(`--objects must be between ${MIN_OBJECT_COUNT} and ${MAX_OBJECT_COUNT}.`);
  process.exit(1);
}

if (!fs.existsSync(dbPath)) {
  console.error(`pod.db not found at ${dbPath}. Run Pod once to create it, then rerun.`);
  process.exit(1);
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const requiredTables = ['collections', 'objects', 'object_references'];
for (const table of requiredTables) {
  const found = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
  if (!found) {
    console.error(`Required table "${table}" is missing from ${dbPath}.`);
    db.close();
    process.exit(1);
  }
}

const seedMetadataPattern = `%"seed":"${SEED}"%`;
const seedCollectionIds = () => db.prepare(
  'SELECT id FROM collections WHERE metadata LIKE ?',
).all(seedMetadataPattern).map((row) => row.id);

function removeSeed() {
  const collectionIds = seedCollectionIds();
  const deleteObjectsByMetadata = db.prepare('DELETE FROM objects WHERE metadata LIKE ?');
  let deletedObjects = deleteObjectsByMetadata.run(seedMetadataPattern).changes;
  let deletedCollections = 0;

  if (collectionIds.length > 0) {
    const placeholders = collectionIds.map(() => '?').join(',');
    deletedObjects += db.prepare(
      `DELETE FROM objects WHERE collection_id IN (${placeholders})`,
    ).run(...collectionIds).changes;
    deletedCollections = db.prepare(
      `DELETE FROM collections WHERE id IN (${placeholders})`,
    ).run(...collectionIds).changes;
  }

  return { deletedObjects, deletedCollections };
}

if (hasFlag('--remove')) {
  const removed = db.transaction(removeSeed)();
  db.pragma('wal_checkpoint(TRUNCATE)');
  db.close();
  console.log(JSON.stringify({ seed: SEED, action: 'removed', ...removed }));
  process.exit(0);
}

const existingCollections = seedCollectionIds().length;
if (existingCollections > 0 && !hasFlag('--reset')) {
  console.error(
    `The ${SEED} corpus already exists (${existingCollections} collections). `
    + 'Use --reset to replace it or --remove to delete it.',
  );
  db.close();
  process.exit(2);
}

const AGENCIES = [
  'NASA', 'European Space Agency', 'Roscosmos', 'JAXA', 'ISRO', 'China National Space Administration',
  'Canadian Space Agency', 'Italian Space Agency', 'German Aerospace Center', 'CNES',
  'UK Space Agency', 'Australian Space Agency', 'Korea Aerospace Research Institute',
  'United Arab Emirates Space Agency', 'Brazilian Space Agency', 'Argentine Space Agency',
  'South African National Space Agency', 'New Zealand Space Agency', 'SpaceX', 'Blue Origin',
  'Rocket Lab', 'Arianespace', 'United Launch Alliance', 'Northrop Grumman', 'Lockheed Martin Space',
];

const PEOPLE = [
  'Yuri Gagarin', 'Valentina Tereshkova', 'Neil Armstrong', 'Buzz Aldrin', 'Michael Collins',
  'Sally Ride', 'Mae Jemison', 'John Glenn', 'Alan Shepard', 'Eileen Collins',
  'Chris Hadfield', 'Peggy Whitson', 'Sunita Williams', 'Kalpana Chawla', 'Rakesh Sharma',
  'Koichi Wakata', 'Chiaki Mukai', 'Yang Liwei', 'Liu Yang', 'Samantha Cristoforetti',
  'Tim Peake', 'Thomas Pesquet', 'Jessica Meir', 'Christina Koch', 'Katherine Johnson',
  'Margaret Hamilton', 'Gene Kranz', 'Sergei Korolev', 'Wernher von Braun', 'Carl Sagan',
  'Nancy Grace Roman', 'Vera Rubin', 'Edwin Hubble', 'Jocelyn Bell Burnell', 'Kip Thorne',
  'Donna Shirley', 'Charles Bolden', 'Gwynne Shotwell', 'Peter Beck', 'Anousheh Ansari',
];

const MISSIONS = [
  'Sputnik 1', 'Vostok 1', 'Vostok 6', 'Mercury-Atlas 6', 'Gemini 4', 'Apollo 8', 'Apollo 11',
  'Apollo 13', 'Apollo 15', 'Luna 9', 'Luna 16', 'Salyut 1', 'Skylab 2', 'Apollo-Soyuz Test Project',
  'Voyager 1', 'Voyager 2', 'Viking 1', 'Pioneer 10', 'Galileo', 'Cassini-Huygens',
  'Magellan', 'Ulysses', 'SOHO', 'Hubble Servicing Mission 1', 'STS-1', 'STS-31', 'STS-93',
  'Mir EO-1', 'ISS Expedition 1', 'ISS Expedition 50', 'Mars Pathfinder', 'Mars Global Surveyor',
  'Spirit', 'Opportunity', 'Phoenix', 'Curiosity', 'MAVEN', 'InSight', 'Perseverance',
  'Mars Sample Return Study', 'Rosetta', 'Giotto', 'Hayabusa', 'Hayabusa2', 'OSIRIS-REx',
  'New Horizons', 'Dawn', 'Juno', 'BepiColombo', 'Solar Orbiter', 'Parker Solar Probe',
  'Kepler', 'TESS', 'Gaia', 'James Webb Space Telescope', 'Euclid', 'Chandrayaan-1',
  'Chandrayaan-3', 'Mangalyaan', 'Aditya-L1', 'Chang’e 4', 'Chang’e 5', 'Tianwen-1',
  'Shenzhou 5', 'Tiangong-1', 'Artemis I', 'Artemis II', 'Gateway HALO', 'DART',
  'Lucy', 'Psyche', 'Europa Clipper', 'Dragonfly', 'JUICE', 'Lunar Trailblazer',
];

const SPACECRAFT = [
  'Sputnik PS-1', 'Vostok 3KA', 'Mercury Friendship 7', 'Gemini spacecraft', 'Apollo command module',
  'Apollo lunar module', 'Soyuz 7K-TM', 'Space Shuttle Columbia', 'Space Shuttle Discovery',
  'Space Shuttle Atlantis', 'Mir core module', 'International Space Station', 'Orion spacecraft',
  'Crew Dragon', 'Starliner', 'Dream Chaser', 'Lunar Gateway', 'Voyager probe', 'Viking lander',
  'Galileo orbiter', 'Cassini orbiter', 'Huygens lander', 'Sojourner rover', 'Spirit rover',
  'Opportunity rover', 'Curiosity rover', 'Perseverance rover', 'Ingenuity helicopter',
  'Rosetta orbiter', 'Philae lander', 'Hayabusa2 spacecraft', 'OSIRIS-REx spacecraft',
  'New Horizons spacecraft', 'Juno spacecraft', 'Parker Solar Probe spacecraft',
  'Hubble Space Telescope', 'James Webb Space Telescope observatory', 'Kepler observatory',
  'Gaia observatory', 'Euclid observatory', 'Chandra X-ray Observatory', 'TESS observatory',
  'Lunar Reconnaissance Orbiter', 'Chandrayaan-3 Vikram lander', 'Chang’e 4 lander',
  'Tianwen-1 orbiter', 'Zhurong rover', 'DART impactor', 'Lucy spacecraft', 'Europa Clipper spacecraft',
];

const DESTINATIONS = [
  'Low Earth orbit', 'International Space Station orbit', 'Geostationary orbit', 'Earth-Moon L1',
  'Earth-Moon L2', 'Sun-Earth L1', 'Sun-Earth L2', 'Moon', 'Lunar south pole', 'Mercury',
  'Venus', 'Mars', 'Phobos', 'Deimos', 'Ceres', 'Vesta', 'Jupiter', 'Europa', 'Ganymede',
  'Callisto', 'Saturn', 'Titan', 'Enceladus', 'Uranus', 'Neptune', 'Triton', 'Pluto',
  'Charon', 'Kuiper belt', 'Interstellar space', 'Asteroid Bennu', 'Asteroid Ryugu',
  'Asteroid Dimorphos', 'Comet 67P', 'Solar corona',
];

const LOCATIONS = [
  'Kennedy Space Center', 'Cape Canaveral Space Force Station', 'Johnson Space Center',
  'Jet Propulsion Laboratory', 'Goddard Space Flight Center', 'Marshall Space Flight Center',
  'Baikonur Cosmodrome', 'Vostochny Cosmodrome', 'Guiana Space Centre', 'Tanegashima Space Center',
  'Satish Dhawan Space Centre', 'Wenchang Spacecraft Launch Site', 'Jiuquan Satellite Launch Center',
  'Taiyuan Satellite Launch Center', 'Xichang Satellite Launch Center', 'Mahia Launch Complex',
  'Vandenberg Space Force Base', 'Wallops Flight Facility', 'Woomera Test Range',
  'Canberra Deep Space Communication Complex', 'Goldstone Deep Space Communications Complex',
  'Madrid Deep Space Communications Complex', 'European Space Operations Centre',
  'Tsukuba Space Center', 'Mohammed Bin Rashid Space Centre',
];

const TECHNOLOGIES = [
  'chemical propulsion', 'ion propulsion', 'Hall-effect thruster', 'solar sail', 'nuclear thermal propulsion',
  'aerobraking', 'gravity assist', 'rendezvous and docking', 'precision landing', 'terrain-relative navigation',
  'entry descent and landing', 'sample return capsule', 'cryogenic propellant storage', 'in-situ resource utilization',
  'closed-loop life support', 'space radiation shielding', 'autonomous fault protection', 'deep-space optical communications',
  'X-band communications', 'Ka-band communications', 'phased-array antenna', 'radioisotope power system',
  'deployable solar array', 'reaction wheel', 'control moment gyroscope', 'star tracker',
  'synthetic aperture radar', 'infrared spectroscopy', 'X-ray astronomy', 'coronagraph',
  'adaptive optics', 'robotic arm', 'regolith excavation', 'heat shield', 'reusable launch vehicle',
  'orbital refuelling', 'formation flying', 'CubeSat avionics', 'quantum sensing', 'space weather forecasting',
];

const PROGRAMS = [
  'Mercury program', 'Gemini program', 'Apollo program', 'Space Shuttle program', 'Salyut program',
  'Mir program', 'International Space Station program', 'Voyager program', 'Viking program',
  'Mars Exploration Program', 'Discovery Program', 'New Frontiers program', 'Great Observatories program',
  'Living With a Star program', 'Artemis program', 'Commercial Crew Program', 'Lunar Gateway program',
  'Luna program', 'Chandrayaan program', 'Chang’e program', 'Shenzhou program', 'Hayabusa program',
  'Copernicus Programme', 'Cosmic Vision programme', 'Deep Space Network', 'Planetary Defense Coordination Office',
];

const DECISIONS = [
  'Adopt reusable lunar lander architecture', 'Prioritize crew safety over launch schedule',
  'Standardize docking interfaces', 'Use solar-electric propulsion for cargo', 'Select the lunar south pole landing zone',
  'Fund a Mars sample return demonstrator', 'Extend International Space Station operations',
  'Build an independent deep-space communications relay', 'Retire the legacy launch vehicle',
  'Share planetary science data openly', 'Choose a direct-ascent mission profile',
  'Add autonomous collision avoidance', 'Require redundant life-support loops',
  'Move the telescope launch to an Ariane vehicle', 'Approve the asteroid deflection test',
  'Sequence robotic scouting before crewed landing', 'Use metric units across mission systems',
  'Preserve propellant margin for contingency operations',
];

const EVENTS = [
  'Sputnik 1 launch', 'First human orbital flight', 'Apollo 11 lunar landing', 'Apollo-Soyuz docking',
  'Voyager 1 Jupiter encounter', 'Space Shuttle first flight', 'Hubble Space Telescope deployment',
  'International Space Station first assembly', 'Mars Pathfinder landing', 'Cassini Saturn orbit insertion',
  'Hayabusa asteroid sample return', 'Curiosity Mars landing', 'Rosetta comet rendezvous',
  'New Horizons Pluto flyby', 'James Webb Space Telescope first images', 'DART asteroid impact',
  'Chandrayaan-3 lunar landing', 'OSIRIS-REx sample delivery', 'Artemis I splashdown',
  'Europa Clipper gravity-assist flyby',
];

const AGENTS = [
  'Flight Dynamics Agent', 'Launch Weather Agent', 'Crew Timeline Agent', 'Telemetry Triage Agent',
  'Rover Navigation Agent', 'Fault Protection Agent', 'Docking Guidance Agent', 'Science Targeting Agent',
  'Mission Planning Agent', 'Ground Station Scheduler', 'Orbital Debris Monitor', 'Sample Curation Agent',
  'Life Support Watcher', 'Radiation Forecast Agent', 'Deep-Space Link Optimizer', 'Landing Site Scout',
];

const PREFERENCES = [
  'Prefer metric units', 'Prefer lossless science telemetry', 'Prefer reusable launch systems',
  'Prefer human-readable mission names', 'Prefer open planetary datasets', 'Prefer redundant communications paths',
  'Prefer daylight landing windows', 'Prefer robotic precursors', 'Prefer low-radiation trajectories',
  'Prefer modular spacecraft buses', 'Prefer proven components for crewed flight', 'Prefer autonomous safe modes',
  'Prefer international mission partnerships', 'Prefer fuel margin over payload margin',
  'Prefer optical links for bulk downlink', 'Prefer simulation before hardware-in-the-loop testing',
];

const RECORD_TYPES = [
  { name: 'Telemetry Streams', label: 'Telemetry record', kind: 'doc' },
  { name: 'Mission Reports', label: 'Mission report', kind: 'doc' },
  { name: 'Engineering Logs', label: 'Engineering log', kind: 'note' },
  { name: 'Observation Notes', label: 'Observation note', kind: 'note' },
  { name: 'Launch Readiness', label: 'Launch readiness report', kind: 'doc' },
  { name: 'Anomaly Reviews', label: 'Anomaly review', kind: 'doc' },
  { name: 'Crew Logs', label: 'Crew log', kind: 'note' },
  { name: 'Experiment Records', label: 'Experiment record', kind: 'doc' },
  { name: 'Deep-Space Communications', label: 'Communications pass', kind: 'doc' },
];

const ANCHOR_GROUPS = [
  { name: 'Agencies & Companies', key: 'agency', values: AGENCIES, mapNodeType: 'organisation' },
  { name: 'People', key: 'person', values: PEOPLE, mapNodeType: 'person' },
  { name: 'Missions', key: 'mission', values: MISSIONS, mapNodeType: 'project' },
  { name: 'Spacecraft & Observatories', key: 'spacecraft', values: SPACECRAFT, mapNodeType: 'tool' },
  { name: 'Destinations', key: 'destination', values: DESTINATIONS, mapNodeType: 'concept' },
  { name: 'Launch & Control Sites', key: 'location', values: LOCATIONS, mapNodeType: 'entity' },
  { name: 'Technologies', key: 'technology', values: TECHNOLOGIES, mapNodeType: 'concept' },
  { name: 'Programs & Networks', key: 'program', values: PROGRAMS, mapNodeType: 'project' },
  { name: 'Decisions', key: 'decision', values: DECISIONS, mapNodeType: 'decision' },
  { name: 'Events & Milestones', key: 'event', values: EVENTS, mapNodeType: 'event' },
  { name: 'Mission Agents', key: 'agent', values: AGENTS, mapNodeType: 'agent' },
  { name: 'Mission Preferences', key: 'preference', values: PREFERENCES, mapNodeType: 'preference' },
];

const seedInt = crypto.createHash('sha256').update(SEED).digest().readUInt32LE(0);
let randomState = seedInt;
const random = () => {
  randomState += 0x6D2B79F5;
  let value = randomState;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
};
const pick = (values) => values[Math.floor(random() * values.length)];
const dateBetween = (start, end) => {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  return new Date(startMs + random() * (endMs - startMs)).toISOString();
};
const stableId = (prefix, key) => {
  const digest = crypto.createHash('sha256').update(`${SEED}|${key}`).digest('hex').slice(0, 24);
  return `${prefix}_${digest}`;
};
const contentHash = (...parts) => ({
  algorithm: 'sha256',
  value: crypto.createHash('sha256').update(parts.join('|')).digest('hex'),
});

const insertCollection = db.prepare(`
  INSERT INTO collections (id, name, parent_id, description, metadata, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const insertObject = db.prepare(`
  INSERT INTO objects (
    id, collection_id, kind, title, content, origin, created_origin, last_modified_by, sync_status, processing_state,
    source_app, source_external_id, source_url, version, hash_algorithm, hash_value, summary, tags, sensitive,
    reflection_claim_count, needs_review, metadata, created_at, updated_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertReference = db.prepare(`
  INSERT OR IGNORE INTO object_references (
    source_object_id, target_object_id, reference_type, source_kind, source_title,
    target_title, reference_key, created_at, updated_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const loadedAt = new Date().toISOString();
const collections = new Map();
const objects = [];
const anchors = new Map();
let referenceCount = 0;

function addCollection(key, name, parentId, description) {
  const id = stableId('col', key);
  insertCollection.run(
    id,
    name,
    parentId,
    description,
    JSON.stringify({ seed: SEED, synthetic: true, graph_stress: true }),
    loadedAt,
    loadedAt,
  );
  collections.set(key, id);
  return id;
}

function addObject({ key, collectionId, kind, title, summary, content, createdAt, tags, metadata = {} }) {
  const id = stableId('obj', key);
  const objectTags = ['synthetic', 'demo', 'graph-stress', ...tags];
  const objectMetadata = {
    ...metadata,
    seed: SEED,
    synthetic: true,
    graph_stress: true,
  };
  const hash = contentHash(kind, title, content, JSON.stringify(objectMetadata), objectTags.join(','));
  const object = { id, kind, title };
  insertObject.run(
    id,
    collectionId,
    kind,
    title,
    JSON.stringify(content),
    'synthetic-seed',
    'synthetic-seed',
    'synthetic-seed',
    'local',
    'idle',
    'synthetic-seed',
    key,
    null,
    1,
    hash.algorithm,
    hash.value,
    summary,
    JSON.stringify(objectTags),
    0,
    0,
    0,
    JSON.stringify(objectMetadata),
    createdAt,
    loadedAt,
  );
  objects.push(object);
  return object;
}

function addReference(source, target, referenceType, timestamp = loadedAt) {
  if (!source || !target || source.id === target.id) return;
  const result = insertReference.run(
    source.id,
    target.id,
    referenceType,
    source.kind,
    source.title,
    target.title,
    target.title,
    timestamp,
    loadedAt,
  );
  referenceCount += result.changes;
}

const startedAt = Date.now();
console.log(`Seeding ${requestedObjectCount} Space Exploration objects into ${dbPath} ...`);

try {
  db.exec('BEGIN IMMEDIATE');

  if (hasFlag('--reset')) {
    const removed = removeSeed();
    console.log(`Reset removed ${removed.deletedObjects} objects and ${removed.deletedCollections} collections.`);
  }

  const rootCollectionId = addCollection(
    'root',
    'Space Exploration Stress Lab',
    null,
    'A clearly synthetic, high-density corpus for exercising Pod graph scale and navigation.',
  );

  for (const group of ANCHOR_GROUPS) {
    const collectionId = addCollection(
      `anchors:${group.key}`,
      group.name,
      rootCollectionId,
      `Synthetic graph anchors for ${group.name.toLowerCase()}.`,
    );
    const groupAnchors = group.values.map((title, index) => addObject({
      key: `anchor:${group.key}:${index}`,
      collectionId,
      kind: 'entity',
      title,
      summary: `Synthetic graph anchor representing ${title} in the Space Exploration stress corpus.`,
      content: `Synthetic stress-test record.\n\n${title} is an anchor used to connect missions, reports, people, systems, and places across this removable demo corpus.`,
      createdAt: dateBetween('1957-10-04', '2026-07-27'),
      tags: [group.key, 'space-exploration'],
      metadata: {
        anchor_type: group.key,
        anchor_index: index,
        map_node_type: group.mapNodeType,
      },
    }));
    anchors.set(group.key, groupAnchors);
  }

  for (const recordType of RECORD_TYPES) {
    addCollection(
      `records:${recordType.name}`,
      recordType.name,
      rootCollectionId,
      `Synthetic ${recordType.name.toLowerCase()} spanning the history and near future of space exploration.`,
    );
  }

  const allAnchorObjects = [...anchors.values()].flat();
  if (requestedObjectCount < allAnchorObjects.length) {
    throw new Error(
      `Requested object count ${requestedObjectCount} is below the ${allAnchorObjects.length} required anchors.`,
    );
  }

  // Give every anchor a place in several cross-domain clusters.
  for (const [groupKey, groupAnchors] of anchors) {
    groupAnchors.forEach((source, index) => {
      const related = groupAnchors[(index + 1) % groupAnchors.length];
      addReference(source, related, 'related_to');

      if (groupKey !== 'program') {
        addReference(source, anchors.get('program')[index % anchors.get('program').length], 'belongs_to');
      }
      if (groupKey !== 'agency') {
        addReference(source, anchors.get('agency')[index % anchors.get('agency').length], 'mentions');
      }
    });
  }

  const bulkObjects = [];
  const bulkCount = requestedObjectCount - allAnchorObjects.length;
  for (let index = 0; index < bulkCount; index++) {
    const recordType = RECORD_TYPES[index % RECORD_TYPES.length];
    const mission = pick(anchors.get('mission'));
    const spacecraft = pick(anchors.get('spacecraft'));
    const agency = pick(anchors.get('agency'));
    const person = pick(anchors.get('person'));
    const destination = pick(anchors.get('destination'));
    const location = pick(anchors.get('location'));
    const technology = pick(anchors.get('technology'));
    const program = pick(anchors.get('program'));
    const createdAt = dateBetween('1957-10-04', '2035-12-31');
    const sequence = String(index + 1).padStart(5, '0');
    const title = `${recordType.label} ${sequence} — ${mission.title} / ${destination.title}`;
    const record = addObject({
      key: `record:${index}`,
      collectionId: collections.get(`records:${recordType.name}`),
      kind: recordType.kind,
      title,
      summary: `Synthetic ${recordType.label.toLowerCase()} linking ${mission.title}, ${spacecraft.title}, and ${destination.title}.`,
      content: [
        'Synthetic stress-test record. This is generated demo data, not an authoritative historical source.',
        '',
        `Mission: ${mission.title}`,
        `Spacecraft: ${spacecraft.title}`,
        `Agency: ${agency.title}`,
        `Lead: ${person.title}`,
        `Destination: ${destination.title}`,
        `Ground site: ${location.title}`,
        `Technology: ${technology.title}`,
        `Program: ${program.title}`,
        `Recorded: ${createdAt.slice(0, 10)}`,
      ].join('\n'),
      createdAt,
      tags: ['space-exploration', recordType.name.toLowerCase().replaceAll(' ', '-')],
      metadata: {
        sequence: index + 1,
        record_type: recordType.name,
        mission: mission.title,
        destination: destination.title,
      },
    });
    bulkObjects.push(record);

    addReference(record, mission, 'mentions', createdAt);
    addReference(record, spacecraft, 'related_to', createdAt);
    addReference(record, agency, 'belongs_to', createdAt);
    addReference(record, person, 'mentions', createdAt);
    addReference(record, destination, 'other_links', createdAt);
    addReference(record, technology, 'derived_from', createdAt);
    addReference(record, location, 'other_links', createdAt);
    addReference(record, program, 'belongs_to', createdAt);

    // Link neighbouring records into long navigable chains as well as anchor hubs.
    if (index > 0) {
      addReference(record, bulkObjects[index - 1], 'related_to', createdAt);
    }
  }

  db.exec('COMMIT');
  db.pragma('wal_checkpoint(TRUNCATE)');

  const totalObjects = db.prepare(
    'SELECT COUNT(*) AS count FROM objects WHERE metadata LIKE ?',
  ).get(seedMetadataPattern).count;
  const totalCollections = db.prepare(
    'SELECT COUNT(*) AS count FROM collections WHERE metadata LIKE ?',
  ).get(seedMetadataPattern).count;
  const totalReferences = db.prepare(`
    SELECT COUNT(*) AS count
    FROM object_references reference
    JOIN objects source ON source.id = reference.source_object_id
    WHERE source.metadata LIKE ?
  `).get(seedMetadataPattern).count;
  const mapNodeTypes = Object.fromEntries(
    ANCHOR_GROUPS.reduce((counts, group) => {
      counts.set(group.mapNodeType, (counts.get(group.mapNodeType) ?? 0) + group.values.length);
      return counts;
    }, new Map()),
  );

  console.log(JSON.stringify({
    seed: SEED,
    action: 'seeded',
    objects: totalObjects,
    collections: totalCollections,
    references: totalReferences,
    map_node_types: mapNodeTypes,
    inserted_references: referenceCount,
    elapsed_ms: Date.now() - startedAt,
  }));
} catch (error) {
  if (db.inTransaction) db.exec('ROLLBACK');
  console.error('Seed failed:', error);
  process.exitCode = 1;
} finally {
  db.close();
}
