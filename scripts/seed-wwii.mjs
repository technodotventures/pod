#!/usr/bin/env node
/**
 * Seed the Pod DB with a WWII history knowledge base — ~2000 objects across
 * People, Battles, Operations, Places, Conferences, Treaties, Weapons, Aircraft,
 * Ships, Units, Concentration Camps, Resistance Movements, Documents, Speeches,
 * Daily Diary Entries, Field Dispatches, and Telegrams.
 *
 * Object titles are intentionally rich with other entity names so the cross-
 * reference name-matcher in /pod/graph spins up a dense set of edges, which is
 * what makes the Map "come to life" at scale.
 *
 *   node scripts/seed-wwii.mjs              # uses ./data/pod.db
 *   node scripts/seed-wwii.mjs --reset      # wipes WWII seed first
 *   COFFEE_POD_DATA_DIR=./foo node scripts/seed-wwii.mjs
 */
import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const dataDir = process.env.COFFEE_POD_DATA_DIR ?? path.join(root, 'data');
const dbPath = path.join(dataDir, 'pod.db');

if (!fs.existsSync(dbPath)) {
  console.error(`pod.db not found at ${dbPath}. Run the server once to create it, then rerun.`);
  process.exit(1);
}

const reset = process.argv.includes('--reset');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Tiny helpers (mirroring db.ts conventions) ────────────────────────────────
const now = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
const hash = (...parts) => ({ algorithm: 'sha256', value: crypto.createHash('sha256').update(parts.join('|')).digest('hex') });
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const sample = (arr, n) => {
  const out = [];
  const pool = [...arr];
  for (let i = 0; i < n && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
};
const dateBetween = (a, b) => {
  const start = new Date(a).getTime();
  const end = new Date(b).getTime();
  const t = start + Math.random() * (end - start);
  return new Date(t).toISOString();
};

// Reset existing seed
if (reset) {
  const cols = db.prepare("SELECT id FROM collections WHERE metadata LIKE '%\"seed\":\"wwii\"%'").all();
  const colIds = cols.map(c => c.id);
  if (colIds.length > 0) {
    const placeholders = colIds.map(() => '?').join(',');
    const deletedObjs = db.prepare(`DELETE FROM objects WHERE collection_id IN (${placeholders})`).run(...colIds).changes;
    const deletedCols = db.prepare(`DELETE FROM collections WHERE id IN (${placeholders})`).run(...colIds).changes;
    console.log(`Reset: removed ${deletedObjs} objects + ${deletedCols} collections.`);
  } else {
    console.log('Reset: no existing WWII seed found.');
  }
}

// ─── Domain data ───────────────────────────────────────────────────────────────

const PEOPLE = [
  // Allied leaders
  { name: 'Winston Churchill', country: 'United Kingdom', role: 'Prime Minister', born: 1874 },
  { name: 'Franklin D. Roosevelt', country: 'United States', role: 'President', born: 1882 },
  { name: 'Joseph Stalin', country: 'Soviet Union', role: 'General Secretary', born: 1878 },
  { name: 'Charles de Gaulle', country: 'France', role: 'Leader of Free France', born: 1890 },
  { name: 'Chiang Kai-shek', country: 'China', role: 'Generalissimo', born: 1887 },
  { name: 'Harry S. Truman', country: 'United States', role: 'President', born: 1884 },
  { name: 'Clement Attlee', country: 'United Kingdom', role: 'Prime Minister', born: 1883 },
  // Axis leaders
  { name: 'Adolf Hitler', country: 'Germany', role: 'Führer', born: 1889 },
  { name: 'Benito Mussolini', country: 'Italy', role: 'Il Duce', born: 1883 },
  { name: 'Hideki Tojo', country: 'Japan', role: 'Prime Minister', born: 1884 },
  { name: 'Emperor Hirohito', country: 'Japan', role: 'Emperor', born: 1901 },
  // Generals & commanders
  { name: 'Dwight D. Eisenhower', country: 'United States', role: 'Supreme Commander, SHAEF', born: 1890 },
  { name: 'George S. Patton', country: 'United States', role: 'General, Third Army', born: 1885 },
  { name: 'Omar Bradley', country: 'United States', role: 'General, 12th Army Group', born: 1893 },
  { name: 'Douglas MacArthur', country: 'United States', role: 'General, Southwest Pacific', born: 1880 },
  { name: 'Chester Nimitz', country: 'United States', role: 'Admiral, Pacific Fleet', born: 1885 },
  { name: 'William Halsey', country: 'United States', role: 'Admiral, Third Fleet', born: 1882 },
  { name: 'Raymond Spruance', country: 'United States', role: 'Admiral, Fifth Fleet', born: 1886 },
  { name: 'Curtis LeMay', country: 'United States', role: 'General, XXI Bomber Command', born: 1906 },
  { name: 'Bernard Montgomery', country: 'United Kingdom', role: 'Field Marshal, 21st Army Group', born: 1887 },
  { name: 'Harold Alexander', country: 'United Kingdom', role: 'Field Marshal, Mediterranean', born: 1891 },
  { name: 'Arthur Harris', country: 'United Kingdom', role: 'Air Chief Marshal, Bomber Command', born: 1892 },
  { name: 'Hugh Dowding', country: 'United Kingdom', role: 'Air Chief Marshal, Fighter Command', born: 1882 },
  { name: 'Louis Mountbatten', country: 'United Kingdom', role: 'Supreme Commander, SEAC', born: 1900 },
  { name: 'Andrew Cunningham', country: 'United Kingdom', role: 'Admiral, Mediterranean Fleet', born: 1883 },
  { name: 'Georgy Zhukov', country: 'Soviet Union', role: 'Marshal', born: 1896 },
  { name: 'Konstantin Rokossovsky', country: 'Soviet Union', role: 'Marshal', born: 1896 },
  { name: 'Ivan Konev', country: 'Soviet Union', role: 'Marshal', born: 1897 },
  { name: 'Vasily Chuikov', country: 'Soviet Union', role: 'General, 62nd Army', born: 1900 },
  { name: 'Erwin Rommel', country: 'Germany', role: 'Field Marshal, Afrika Korps', born: 1891 },
  { name: 'Heinz Guderian', country: 'Germany', role: 'General, Panzer forces', born: 1888 },
  { name: 'Gerd von Rundstedt', country: 'Germany', role: 'Field Marshal', born: 1875 },
  { name: 'Erich von Manstein', country: 'Germany', role: 'Field Marshal', born: 1887 },
  { name: 'Walther Model', country: 'Germany', role: 'Field Marshal', born: 1891 },
  { name: 'Friedrich Paulus', country: 'Germany', role: 'Field Marshal, Sixth Army', born: 1890 },
  { name: 'Karl Dönitz', country: 'Germany', role: 'Grand Admiral, U-boat fleet', born: 1891 },
  { name: 'Hermann Göring', country: 'Germany', role: 'Reichsmarschall, Luftwaffe', born: 1893 },
  { name: 'Heinrich Himmler', country: 'Germany', role: 'Reichsführer-SS', born: 1900 },
  { name: 'Joseph Goebbels', country: 'Germany', role: 'Minister of Propaganda', born: 1897 },
  { name: 'Albert Speer', country: 'Germany', role: 'Minister of Armaments', born: 1905 },
  { name: 'Reinhard Heydrich', country: 'Germany', role: 'Reich Protector of Bohemia-Moravia', born: 1904 },
  { name: 'Adolf Eichmann', country: 'Germany', role: 'SS Obersturmbannführer', born: 1906 },
  { name: 'Isoroku Yamamoto', country: 'Japan', role: 'Admiral, Combined Fleet', born: 1884 },
  { name: 'Chuichi Nagumo', country: 'Japan', role: 'Vice-Admiral, First Air Fleet', born: 1887 },
  { name: 'Tomoyuki Yamashita', country: 'Japan', role: 'General, Tiger of Malaya', born: 1885 },
  { name: 'Mineichi Koga', country: 'Japan', role: 'Admiral, Combined Fleet', born: 1885 },
  { name: 'Pietro Badoglio', country: 'Italy', role: 'Marshal of Italy', born: 1871 },
  { name: 'Italo Balbo', country: 'Italy', role: 'Marshal, North Africa', born: 1896 },
  // Other figures
  { name: 'Anne Frank', country: 'Netherlands', role: 'Diarist', born: 1929 },
  { name: 'Oskar Schindler', country: 'Germany', role: 'Industrialist', born: 1908 },
  { name: 'Raoul Wallenberg', country: 'Sweden', role: 'Diplomat', born: 1912 },
  { name: 'Audie Murphy', country: 'United States', role: 'Soldier, Medal of Honor', born: 1925 },
  { name: 'Vasily Zaitsev', country: 'Soviet Union', role: 'Sniper, 62nd Army', born: 1915 },
  { name: 'Erich Hartmann', country: 'Germany', role: 'Luftwaffe ace (352 victories)', born: 1922 },
  { name: 'Saburo Sakai', country: 'Japan', role: 'Naval aviator', born: 1916 },
  { name: 'Richard Bong', country: 'United States', role: 'P-38 ace (40 victories)', born: 1920 },
  { name: 'Alan Turing', country: 'United Kingdom', role: 'Mathematician, Bletchley Park', born: 1912 },
  { name: 'Robert Oppenheimer', country: 'United States', role: 'Director, Manhattan Project', born: 1904 },
  { name: 'Leslie Groves', country: 'United States', role: 'General, Manhattan Project', born: 1896 },
  { name: 'Enrico Fermi', country: 'United States', role: 'Physicist, Manhattan Project', born: 1901 },
  { name: 'Werner Heisenberg', country: 'Germany', role: 'Physicist, Uranverein', born: 1901 },
  { name: 'Wernher von Braun', country: 'Germany', role: 'Engineer, V-2 program', born: 1912 },
  { name: 'Tibbets Paul', country: 'United States', role: 'Colonel, Enola Gay', born: 1915 },
];

const BATTLES = [
  { name: 'Battle of the Atlantic', start: '1939-09-03', end: '1945-05-08', theater: 'Atlantic' },
  { name: 'Invasion of Poland', start: '1939-09-01', end: '1939-10-06', theater: 'Eastern Europe' },
  { name: 'Battle of France', start: '1940-05-10', end: '1940-06-25', theater: 'Western Europe' },
  { name: 'Battle of Dunkirk', start: '1940-05-26', end: '1940-06-04', theater: 'Western Europe' },
  { name: 'Battle of Britain', start: '1940-07-10', end: '1940-10-31', theater: 'Western Europe' },
  { name: 'Battle of Crete', start: '1941-05-20', end: '1941-06-01', theater: 'Mediterranean' },
  { name: 'Operation Barbarossa', start: '1941-06-22', end: '1941-12-05', theater: 'Eastern Front' },
  { name: 'Siege of Leningrad', start: '1941-09-08', end: '1944-01-27', theater: 'Eastern Front' },
  { name: 'Battle of Moscow', start: '1941-09-30', end: '1942-01-07', theater: 'Eastern Front' },
  { name: 'Attack on Pearl Harbor', start: '1941-12-07', end: '1941-12-07', theater: 'Pacific' },
  { name: 'Fall of Singapore', start: '1942-01-31', end: '1942-02-15', theater: 'Pacific' },
  { name: 'Battle of the Java Sea', start: '1942-02-27', end: '1942-03-01', theater: 'Pacific' },
  { name: 'Doolittle Raid', start: '1942-04-18', end: '1942-04-18', theater: 'Pacific' },
  { name: 'Battle of the Coral Sea', start: '1942-05-04', end: '1942-05-08', theater: 'Pacific' },
  { name: 'Battle of Midway', start: '1942-06-04', end: '1942-06-07', theater: 'Pacific' },
  { name: 'Battle of Stalingrad', start: '1942-08-23', end: '1943-02-02', theater: 'Eastern Front' },
  { name: 'Guadalcanal Campaign', start: '1942-08-07', end: '1943-02-09', theater: 'Pacific' },
  { name: 'Second Battle of El Alamein', start: '1942-10-23', end: '1942-11-11', theater: 'North Africa' },
  { name: 'Operation Torch', start: '1942-11-08', end: '1942-11-16', theater: 'North Africa' },
  { name: 'Battle of Kursk', start: '1943-07-05', end: '1943-08-23', theater: 'Eastern Front' },
  { name: 'Allied invasion of Sicily', start: '1943-07-09', end: '1943-08-17', theater: 'Mediterranean' },
  { name: 'Allied invasion of Italy', start: '1943-09-03', end: '1943-09-16', theater: 'Mediterranean' },
  { name: 'Battle of Monte Cassino', start: '1944-01-17', end: '1944-05-18', theater: 'Mediterranean' },
  { name: 'Battle of Anzio', start: '1944-01-22', end: '1944-06-05', theater: 'Mediterranean' },
  { name: 'D-Day landings', start: '1944-06-06', end: '1944-06-06', theater: 'Western Europe' },
  { name: 'Battle of Normandy', start: '1944-06-06', end: '1944-08-25', theater: 'Western Europe' },
  { name: 'Battle of the Philippine Sea', start: '1944-06-19', end: '1944-06-20', theater: 'Pacific' },
  { name: 'Operation Bagration', start: '1944-06-22', end: '1944-08-19', theater: 'Eastern Front' },
  { name: 'Warsaw Uprising', start: '1944-08-01', end: '1944-10-02', theater: 'Eastern Front' },
  { name: 'Liberation of Paris', start: '1944-08-19', end: '1944-08-25', theater: 'Western Europe' },
  { name: 'Operation Market Garden', start: '1944-09-17', end: '1944-09-25', theater: 'Western Europe' },
  { name: 'Battle of Leyte Gulf', start: '1944-10-23', end: '1944-10-26', theater: 'Pacific' },
  { name: 'Battle of the Bulge', start: '1944-12-16', end: '1945-01-25', theater: 'Western Europe' },
  { name: 'Battle of Iwo Jima', start: '1945-02-19', end: '1945-03-26', theater: 'Pacific' },
  { name: 'Battle of Okinawa', start: '1945-04-01', end: '1945-06-22', theater: 'Pacific' },
  { name: 'Battle of Berlin', start: '1945-04-16', end: '1945-05-02', theater: 'Eastern Front' },
  { name: 'Vistula–Oder Offensive', start: '1945-01-12', end: '1945-02-02', theater: 'Eastern Front' },
];

const OPERATIONS = [
  { name: 'Operation Sea Lion', desc: 'planned German invasion of Britain — never executed' },
  { name: 'Operation Dynamo', desc: 'evacuation of British and Allied troops from Dunkirk' },
  { name: 'Operation Eagle Attack', desc: 'Luftwaffe air offensive against the RAF' },
  { name: 'Operation Cerberus', desc: 'Channel Dash of the Scharnhorst and Gneisenau' },
  { name: 'Operation Drumbeat', desc: 'U-boat campaign against US East Coast shipping' },
  { name: 'Operation Pedestal', desc: 'critical Malta convoy of August 1942' },
  { name: 'Operation Husky', desc: 'Allied invasion of Sicily' },
  { name: 'Operation Avalanche', desc: 'Allied landings at Salerno' },
  { name: 'Operation Shingle', desc: 'Allied landings at Anzio' },
  { name: 'Operation Overlord', desc: 'Allied invasion of Normandy' },
  { name: 'Operation Neptune', desc: 'naval component of Operation Overlord' },
  { name: 'Operation Dragoon', desc: 'Allied invasion of southern France' },
  { name: 'Operation Cobra', desc: 'breakout from Normandy by First US Army' },
  { name: 'Operation Goodwood', desc: 'British armoured offensive east of Caen' },
  { name: 'Operation Totalize', desc: 'Canadian-led offensive towards Falaise' },
  { name: 'Operation Plunder', desc: 'crossing of the Rhine by 21st Army Group' },
  { name: 'Operation Varsity', desc: 'airborne component of the Rhine crossing' },
  { name: 'Operation Watch on the Rhine', desc: 'German offensive in the Ardennes' },
  { name: 'Operation Bodyguard', desc: 'deception plan masking D-Day landings' },
  { name: 'Operation Fortitude', desc: 'sub-deception within Bodyguard' },
  { name: 'Operation Chastise', desc: 'RAF Dambusters raid on Ruhr dams' },
  { name: 'Operation Gomorrah', desc: 'firebombing of Hamburg' },
  { name: 'Operation Tidal Wave', desc: 'low-level raid on Ploiești oil refineries' },
  { name: 'Operation Hump', desc: 'aerial resupply route over the Himalayas to China' },
  { name: 'Operation Cartwheel', desc: 'Allied island-hopping campaign in the Pacific' },
  { name: 'Operation Forager', desc: 'invasion of the Marianas' },
  { name: 'Operation Detachment', desc: 'invasion of Iwo Jima' },
  { name: 'Operation Iceberg', desc: 'invasion of Okinawa' },
  { name: 'Operation Downfall', desc: 'planned invasion of Japan — never executed' },
  { name: 'Operation Olympic', desc: 'planned invasion of Kyushu' },
  { name: 'Operation Coronet', desc: 'planned invasion of the Kantō Plain' },
  { name: 'Operation Vengeance', desc: 'targeted killing of Admiral Yamamoto' },
  { name: 'Operation Mincemeat', desc: 'deception of Axis ahead of Sicily landings' },
  { name: 'Operation Anthropoid', desc: 'assassination of Reinhard Heydrich' },
  { name: 'Operation Valkyrie', desc: 'July 20 plot against Adolf Hitler' },
  { name: 'Operation Uranus', desc: 'Soviet encirclement of the German Sixth Army at Stalingrad' },
  { name: 'Operation Citadel', desc: 'German offensive at Kursk' },
  { name: 'Operation Bagration', desc: 'Soviet Belorussian Strategic Offensive' },
  { name: 'Operation Mars', desc: 'Soviet offensive in Rzhev salient' },
  { name: 'Operation Saturn', desc: 'Soviet operation following Uranus' },
];

const PLACES = [
  { name: 'London', country: 'United Kingdom' },
  { name: 'Berlin', country: 'Germany' },
  { name: 'Moscow', country: 'Soviet Union' },
  { name: 'Washington', country: 'United States' },
  { name: 'Tokyo', country: 'Japan' },
  { name: 'Rome', country: 'Italy' },
  { name: 'Paris', country: 'France' },
  { name: 'Warsaw', country: 'Poland' },
  { name: 'Vienna', country: 'Austria' },
  { name: 'Prague', country: 'Czechoslovakia' },
  { name: 'Athens', country: 'Greece' },
  { name: 'Cairo', country: 'Egypt' },
  { name: 'Algiers', country: 'Algeria' },
  { name: 'Casablanca', country: 'Morocco' },
  { name: 'Tobruk', country: 'Libya' },
  { name: 'Singapore', country: 'Malaya' },
  { name: 'Hong Kong', country: 'British Hong Kong' },
  { name: 'Manila', country: 'Philippines' },
  { name: 'Honolulu', country: 'United States' },
  { name: 'Pearl Harbor', country: 'United States' },
  { name: 'Hiroshima', country: 'Japan' },
  { name: 'Nagasaki', country: 'Japan' },
  { name: 'Dresden', country: 'Germany' },
  { name: 'Hamburg', country: 'Germany' },
  { name: 'Cologne', country: 'Germany' },
  { name: 'Stalingrad', country: 'Soviet Union' },
  { name: 'Leningrad', country: 'Soviet Union' },
  { name: 'Kiev', country: 'Soviet Union' },
  { name: 'Sevastopol', country: 'Soviet Union' },
  { name: 'Kursk', country: 'Soviet Union' },
  { name: 'Normandy', country: 'France' },
  { name: 'Caen', country: 'France' },
  { name: 'Arnhem', country: 'Netherlands' },
  { name: 'Bastogne', country: 'Belgium' },
  { name: 'Anzio', country: 'Italy' },
  { name: 'Monte Cassino', country: 'Italy' },
  { name: 'Salerno', country: 'Italy' },
  { name: 'El Alamein', country: 'Egypt' },
  { name: 'Tunis', country: 'Tunisia' },
  { name: 'Bletchley Park', country: 'United Kingdom' },
  { name: 'Los Alamos', country: 'United States' },
  { name: 'Oak Ridge', country: 'United States' },
  { name: 'Yalta', country: 'Crimea' },
  { name: 'Potsdam', country: 'Germany' },
  { name: 'Tehran', country: 'Iran' },
  { name: 'Iwo Jima', country: 'Japan' },
  { name: 'Okinawa', country: 'Japan' },
  { name: 'Midway Atoll', country: 'United States' },
  { name: 'Guadalcanal', country: 'Solomon Islands' },
  { name: 'Bataan', country: 'Philippines' },
  { name: 'Corregidor', country: 'Philippines' },
];

const CONFERENCES = [
  { name: 'Munich Agreement', date: '1938-09-30', participants: ['Adolf Hitler', 'Benito Mussolini', 'Édouard Daladier', 'Neville Chamberlain'] },
  { name: 'Atlantic Conference', date: '1941-08-14', participants: ['Winston Churchill', 'Franklin D. Roosevelt'] },
  { name: 'Casablanca Conference', date: '1943-01-14', participants: ['Winston Churchill', 'Franklin D. Roosevelt', 'Charles de Gaulle'] },
  { name: 'Trident Conference', date: '1943-05-12', participants: ['Winston Churchill', 'Franklin D. Roosevelt'] },
  { name: 'Quadrant Conference', date: '1943-08-17', participants: ['Winston Churchill', 'Franklin D. Roosevelt', 'William Lyon Mackenzie King'] },
  { name: 'Cairo Conference', date: '1943-11-22', participants: ['Winston Churchill', 'Franklin D. Roosevelt', 'Chiang Kai-shek'] },
  { name: 'Tehran Conference', date: '1943-11-28', participants: ['Winston Churchill', 'Franklin D. Roosevelt', 'Joseph Stalin'] },
  { name: 'Bretton Woods Conference', date: '1944-07-01' },
  { name: 'Dumbarton Oaks Conference', date: '1944-08-21' },
  { name: 'Yalta Conference', date: '1945-02-04', participants: ['Winston Churchill', 'Franklin D. Roosevelt', 'Joseph Stalin'] },
  { name: 'Potsdam Conference', date: '1945-07-17', participants: ['Winston Churchill', 'Harry S. Truman', 'Joseph Stalin', 'Clement Attlee'] },
];

const TREATIES = [
  { name: 'Molotov–Ribbentrop Pact', date: '1939-08-23' },
  { name: 'Tripartite Pact', date: '1940-09-27' },
  { name: 'Lend-Lease Act', date: '1941-03-11' },
  { name: 'Anglo-Soviet Treaty', date: '1942-05-26' },
  { name: 'Italian Armistice', date: '1943-09-08' },
  { name: 'Romanian Armistice', date: '1944-09-12' },
  { name: 'Bulgarian Armistice', date: '1944-10-28' },
  { name: 'German Instrument of Surrender', date: '1945-05-08' },
  { name: 'Japanese Instrument of Surrender', date: '1945-09-02' },
];

const WEAPONS = [
  'Tiger I tank', 'Tiger II tank', 'Panther tank', 'Panzer IV', 'StuG III', 'Elefant tank destroyer',
  'M4 Sherman tank', 'M3 Stuart tank', 'M26 Pershing tank', 'T-34 tank', 'T-34/85 tank', 'KV-1 tank', 'IS-2 tank',
  'Cromwell tank', 'Churchill tank', 'Matilda II tank', 'Crusader tank', 'Comet tank',
  'M1 Garand rifle', 'Karabiner 98k rifle', 'Lee–Enfield rifle', 'Mosin–Nagant rifle', 'Type 99 rifle',
  'MG 42 machine gun', 'MG 34 machine gun', 'Browning M1919', 'PPSh-41 submachine gun', 'Sten gun',
  'Thompson submachine gun', 'MP 40 submachine gun', 'Bren light machine gun',
  'Panzerfaust', 'Bazooka', 'PIAT', 'Flak 88', '76 mm divisional gun', 'Howitzer M2A1',
  'V-1 flying bomb', 'V-2 rocket', 'Schwerer Gustav railway gun', 'Karl-Gerät mortar',
  'Atomic bomb Little Boy', 'Atomic bomb Fat Man', 'Mark 14 torpedo', 'Type 93 Long Lance torpedo',
];

const AIRCRAFT = [
  'Supermarine Spitfire', 'Hawker Hurricane', 'Hawker Typhoon', 'Hawker Tempest',
  'Avro Lancaster', 'Handley Page Halifax', 'Short Stirling', 'de Havilland Mosquito',
  'P-51 Mustang', 'P-47 Thunderbolt', 'P-38 Lightning', 'P-40 Warhawk', 'F4F Wildcat', 'F6F Hellcat', 'F4U Corsair',
  'B-17 Flying Fortress', 'B-24 Liberator', 'B-25 Mitchell', 'B-26 Marauder', 'B-29 Superfortress',
  'SBD Dauntless', 'TBF Avenger', 'PBY Catalina',
  'Messerschmitt Bf 109', 'Messerschmitt Bf 110', 'Messerschmitt Me 262', 'Messerschmitt Me 163',
  'Focke-Wulf Fw 190', 'Junkers Ju 87 Stuka', 'Junkers Ju 88', 'Heinkel He 111', 'Dornier Do 17',
  'Mitsubishi A6M Zero', 'Mitsubishi G4M Betty', 'Aichi D3A Val', 'Nakajima B5N Kate', 'Kawanishi N1K',
  'Yakovlev Yak-3', 'Yakovlev Yak-9', 'Lavochkin La-5', 'Ilyushin Il-2 Sturmovik', 'Tupolev Tu-2',
  'Macchi C.202', 'Fiat G.55', 'Reggiane Re.2005',
];

const SHIPS = [
  'HMS Hood', 'HMS Prince of Wales', 'HMS King George V', 'HMS Rodney', 'HMS Repulse', 'HMS Ark Royal', 'HMS Illustrious', 'HMS Victorious',
  'USS Arizona', 'USS Missouri', 'USS Iowa', 'USS New Jersey', 'USS Enterprise', 'USS Hornet', 'USS Yorktown', 'USS Lexington', 'USS Wasp',
  'USS Indianapolis', 'USS Houston', 'USS Saratoga', 'USS Franklin', 'USS Essex',
  'Bismarck', 'Tirpitz', 'Scharnhorst', 'Gneisenau', 'Admiral Graf Spee', 'Admiral Scheer', 'Prinz Eugen', 'Admiral Hipper',
  'Yamato', 'Musashi', 'Akagi', 'Kaga', 'Soryu', 'Hiryu', 'Shokaku', 'Zuikaku', 'Shoho', 'Junyo',
  'Roma', 'Vittorio Veneto', 'Littorio', 'Conte di Cavour',
  'U-47', 'U-99', 'U-110', 'U-505', 'U-571',
];

const UNITS = [
  '1st Infantry Division (Big Red One)', '82nd Airborne Division (All American)', '101st Airborne Division (Screaming Eagles)',
  '4th Infantry Division', '29th Infantry Division', '2nd Armored Division (Hell on Wheels)', '3rd Armored Division (Spearhead)',
  '442nd Regimental Combat Team', 'Tuskegee Airmen', 'Big Week Eighth Air Force',
  '21st Army Group', '12th Army Group', '6th Army Group', 'Third US Army', 'First US Army', 'Ninth US Army',
  'British 7th Armoured Division (Desert Rats)', 'British 50th Northumbrian Division', '1st Polish Armoured Division',
  '1st Canadian Army', '2nd Canadian Infantry Division',
  'Afrika Korps', '7th Panzer Division (Ghost Division)', '21st Panzer Division', '1st SS Panzer Division Leibstandarte',
  '2nd SS Panzer Division Das Reich', '12th SS Panzer Division Hitlerjugend', 'Großdeutschland Division',
  '6th German Army', '4th Panzer Army', '11th Army',
  '62nd Soviet Army', '64th Soviet Army', '1st Belorussian Front', '1st Ukrainian Front', '3rd Ukrainian Front',
  'Imperial Japanese 25th Army', 'Imperial Japanese 14th Area Army', '1st Marine Division', '2nd Marine Division', '5th Marine Division',
];

const CAMPS = [
  'Auschwitz-Birkenau', 'Buchenwald', 'Dachau', 'Mauthausen', 'Bergen-Belsen', 'Sobibor', 'Treblinka',
  'Chełmno', 'Majdanek', 'Theresienstadt', 'Ravensbrück', 'Sachsenhausen', 'Belzec',
];

const RESISTANCE = [
  'French Resistance (Maquis)', 'Polish Home Army (Armia Krajowa)', 'Yugoslav Partisans', 'Greek People\'s Liberation Army',
  'Norwegian resistance movement', 'Dutch resistance', 'Belgian Resistance', 'Italian Resistance (CLN)',
  'Soviet partisans', 'Slovak National Uprising', 'White Rose movement', 'July 20 plot',
];

const DOCUMENTS = [
  'Atlantic Charter', 'Declaration by United Nations', 'Casablanca Declaration', 'Cairo Declaration',
  'Tehran Declaration', 'Yalta Agreement', 'Potsdam Declaration', 'Final Solution Wannsee protocol',
  'Commando Order', 'Commissar Order', 'Hossbach Memorandum',
  'Lend-Lease Agreement', 'Anglo-Polish military alliance', 'Tripartite Pact text',
];

const SPEECHES = [
  { name: 'We shall fight on the beaches', speaker: 'Winston Churchill', date: '1940-06-04' },
  { name: 'Their finest hour', speaker: 'Winston Churchill', date: '1940-06-18' },
  { name: 'Blood, toil, tears and sweat', speaker: 'Winston Churchill', date: '1940-05-13' },
  { name: 'Day of Infamy speech', speaker: 'Franklin D. Roosevelt', date: '1941-12-08' },
  { name: 'Four Freedoms speech', speaker: 'Franklin D. Roosevelt', date: '1941-01-06' },
  { name: 'Sportpalast speech (Total War)', speaker: 'Joseph Goebbels', date: '1943-02-18' },
  { name: 'Iron Curtain speech', speaker: 'Winston Churchill', date: '1946-03-05' },
  { name: 'Gyokuon-hōsō surrender broadcast', speaker: 'Emperor Hirohito', date: '1945-08-15' },
];

// ─── Insert helpers ────────────────────────────────────────────────────────────
const insertCol = db.prepare(`
  INSERT INTO collections (id, name, parent_id, description, metadata, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertObj = db.prepare(`
  INSERT INTO objects (
    id, collection_id, kind, title, content, origin, created_origin, last_modified_by, sync_status, processing_state,
    source_app, source_external_id, source_url, version, hash_algorithm, hash_value, summary, tags, sensitive,
    reflection_claim_count, needs_review, metadata, created_at, updated_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

function addCollection(name, parentId, description) {
  const id = makeId('col');
  const ts = now();
  insertCol.run(id, name, parentId, description, JSON.stringify({ seed: 'wwii' }), ts, ts);
  return id;
}

function addObject({ collectionId, kind, title, summary, content, createdAt, tags = [], metadata = {} }) {
  const id = makeId('obj');
  const ts = createdAt || now();
  const h = hash(kind, title, content ?? '', JSON.stringify(metadata), tags.join(','));
  const meta = { ...metadata, seed: 'wwii', tags };
  insertObj.run(
    id,
    collectionId,
    kind,
    title,
    content != null ? JSON.stringify(content) : null,
    'seed',                  // origin
    'seed',                  // created_origin
    'seed',                  // last_modified_by
    'local',                 // sync_status
    'idle',                  // processing_state
    'seed',                  // source_app
    null, null,              // external_id, url
    1,                       // version
    h.algorithm, h.value,    // hash
    summary,
    JSON.stringify(tags),
    0,                       // sensitive
    0,                       // reflection_claim_count
    0,                       // needs_review
    JSON.stringify(meta),
    ts, ts,
  );
}

// ─── Generation ────────────────────────────────────────────────────────────────
console.log(`Seeding WWII history into ${dbPath} ...`);

const t0 = Date.now();
db.exec('BEGIN');
try {
  // Top-level collection
  const wwiiId = addCollection('World War II', null, 'A knowledge graph of WWII history — seeded for the Map module.');

  // Sub-collections
  const peopleCol = addCollection('People', wwiiId, 'Leaders, commanders, scientists, civilians, soldiers.');
  const battlesCol = addCollection('Battles & Campaigns', wwiiId, 'Major battles and operational campaigns.');
  const operationsCol = addCollection('Operations', wwiiId, 'Named military operations.');
  const placesCol = addCollection('Places', wwiiId, 'Cities, theatres, and locations of significance.');
  const conferencesCol = addCollection('Conferences', wwiiId, 'Diplomatic conferences and summits.');
  const treatiesCol = addCollection('Treaties & Agreements', wwiiId, 'Treaties, pacts, and instruments of surrender.');
  const weaponsCol = addCollection('Weapons & Vehicles', wwiiId, 'Tanks, artillery, small arms, special weapons.');
  const aircraftCol = addCollection('Aircraft', wwiiId, 'Fighter planes, bombers, transports across all theatres.');
  const shipsCol = addCollection('Ships', wwiiId, 'Battleships, aircraft carriers, U-boats.');
  const unitsCol = addCollection('Units', wwiiId, 'Divisions, regiments, and named formations.');
  const campsCol = addCollection('Concentration Camps', wwiiId, 'Nazi camps and extermination facilities.');
  const resistanceCol = addCollection('Resistance Movements', wwiiId, 'Underground and partisan movements.');
  const documentsCol = addCollection('Documents', wwiiId, 'Treaties, declarations, and key papers.');
  const speechesCol = addCollection('Speeches', wwiiId, 'Major wartime addresses and broadcasts.');
  const diaryCol = addCollection('Field Diary Entries', wwiiId, 'First-person diary entries from soldiers and civilians.');
  const dispatchCol = addCollection('Battlefield Dispatches', wwiiId, 'Field commander reports and situation updates.');
  const telegramCol = addCollection('Telegrams', wwiiId, 'Wartime cables and communiqués between commands.');

  let count = 0;

  // People (~60)
  for (const p of PEOPLE) {
    addObject({
      collectionId: peopleCol,
      kind: 'note',
      title: p.name,
      summary: `${p.role} of ${p.country} (b. ${p.born}). Active throughout the war.`,
      content: `# ${p.name}\n\n**Role:** ${p.role}\n**Country:** ${p.country}\n**Born:** ${p.born}\n\nBiographical entry seeded for the WWII demo graph.`,
      tags: ['person', p.country.toLowerCase().replace(/[^a-z]+/g, '-')],
      metadata: { country: p.country, role: p.role, born: p.born },
    });
    count++;
  }

  // Battles (~37)
  for (const b of BATTLES) {
    const involvedPeople = sample(PEOPLE, 2 + Math.floor(Math.random() * 3));
    addObject({
      collectionId: battlesCol,
      kind: 'doc',
      title: b.name,
      summary: `Engagement in the ${b.theater} theatre, ${b.start} → ${b.end}.`,
      content: `# ${b.name}\n\n**Theatre:** ${b.theater}\n**Dates:** ${b.start} — ${b.end}\n\n**Key commanders mentioned:** ${involvedPeople.map(p => p.name).join(', ')}.`,
      tags: ['battle', b.theater.toLowerCase().replace(/[^a-z]+/g, '-')],
      createdAt: b.start + 'T08:00:00Z',
      metadata: { theater: b.theater, start: b.start, end: b.end },
    });
    count++;
  }

  // Operations (~40)
  for (const o of OPERATIONS) {
    const involvedPeople = sample(PEOPLE, 2);
    addObject({
      collectionId: operationsCol,
      kind: 'doc',
      title: o.name,
      summary: o.desc,
      content: `# ${o.name}\n\n${o.desc}.\n\nCommanders involved: ${involvedPeople.map(p => p.name).join(', ')}.`,
      tags: ['operation'],
    });
    count++;
  }

  // Places (~51)
  for (const place of PLACES) {
    addObject({
      collectionId: placesCol,
      kind: 'note',
      title: place.name,
      summary: `${place.name} — ${place.country}. Location of significance during WWII.`,
      content: `# ${place.name}\n\n**Country:** ${place.country}\n\nReferenced across many battles, operations, and dispatches.`,
      tags: ['place'],
      metadata: { country: place.country },
    });
    count++;
  }

  // Conferences (~11)
  for (const c of CONFERENCES) {
    const parts = (c.participants ?? []).join(', ');
    addObject({
      collectionId: conferencesCol,
      kind: 'doc',
      title: c.name,
      summary: `Diplomatic conference, ${c.date}.${parts ? ` Attendees: ${parts}.` : ''}`,
      content: `# ${c.name}\n\n**Date:** ${c.date}\n\n${parts ? `**Participants:** ${parts}\n` : ''}\nThis conference shaped wartime strategy and post-war planning.`,
      tags: ['conference'],
      createdAt: c.date + 'T10:00:00Z',
      metadata: { participants: c.participants ?? [] },
    });
    count++;
  }

  // Treaties (~9)
  for (const t of TREATIES) {
    addObject({
      collectionId: treatiesCol,
      kind: 'doc',
      title: t.name,
      summary: `Signed ${t.date}.`,
      content: `# ${t.name}\n\n**Date signed:** ${t.date}\n\nKey diplomatic instrument shaping the war.`,
      tags: ['treaty'],
      createdAt: t.date + 'T12:00:00Z',
    });
    count++;
  }

  // Weapons (~44)
  for (const w of WEAPONS) {
    addObject({
      collectionId: weaponsCol,
      kind: 'note',
      title: w,
      summary: `${w} — service weapon of WWII.`,
      content: `# ${w}\n\nFielded across multiple battles and operations during the war.`,
      tags: ['weapon'],
    });
    count++;
  }

  // Aircraft (~43)
  for (const a of AIRCRAFT) {
    addObject({
      collectionId: aircraftCol,
      kind: 'note',
      title: a,
      summary: `${a} — military aircraft of WWII.`,
      content: `# ${a}\n\nFlown by major air forces during WWII.`,
      tags: ['aircraft'],
    });
    count++;
  }

  // Ships (~48)
  for (const s of SHIPS) {
    addObject({
      collectionId: shipsCol,
      kind: 'note',
      title: s,
      summary: `${s} — warship of WWII.`,
      content: `# ${s}\n\nServed in major naval engagements of the war.`,
      tags: ['ship'],
    });
    count++;
  }

  // Units (~40)
  for (const u of UNITS) {
    addObject({
      collectionId: unitsCol,
      kind: 'note',
      title: u,
      summary: `${u} — military formation of WWII.`,
      content: `# ${u}\n\nDeployed across the campaigns of WWII.`,
      tags: ['unit'],
    });
    count++;
  }

  // Camps (~13)
  for (const c of CAMPS) {
    addObject({
      collectionId: campsCol,
      kind: 'note',
      title: c,
      summary: `${c} — Nazi camp.`,
      content: `# ${c}\n\nOperated by the SS during the war.`,
      tags: ['camp', 'holocaust'],
    });
    count++;
  }

  // Resistance (~12)
  for (const r of RESISTANCE) {
    addObject({
      collectionId: resistanceCol,
      kind: 'note',
      title: r,
      summary: `${r} — wartime resistance movement.`,
      content: `# ${r}\n\nOperated under occupation conditions during WWII.`,
      tags: ['resistance'],
    });
    count++;
  }

  // Documents (~14)
  for (const d of DOCUMENTS) {
    addObject({
      collectionId: documentsCol,
      kind: 'doc',
      title: d,
      summary: `Key document of WWII: ${d}.`,
      content: `# ${d}\n\nFoundational document of the period.`,
      tags: ['document'],
    });
    count++;
  }

  // Speeches (~8)
  for (const s of SPEECHES) {
    addObject({
      collectionId: speechesCol,
      kind: 'doc',
      title: s.name,
      summary: `Delivered by ${s.speaker} on ${s.date}.`,
      content: `# ${s.name}\n\n**Speaker:** ${s.speaker}\n**Date:** ${s.date}\n\nA defining wartime address.`,
      tags: ['speech'],
      createdAt: s.date + 'T15:00:00Z',
      metadata: { speaker: s.speaker, date: s.date },
    });
    count++;
  }

  // ─── Templated bulk content to reach 2000 ────────────────────────────────────
  // Aim for ~2000 total. We've added ~430 so far; we need ~1570 more.

  // Diary entries (~500)
  const diaryWriters = PEOPLE.filter(p => p.role.includes('General') || p.role.includes('Field') || p.role.includes('Admiral') || p.role.includes('Diarist'));
  for (let i = 0; i < 500; i++) {
    const writer = rand(diaryWriters.length > 0 ? diaryWriters : PEOPLE);
    const battle = rand(BATTLES);
    const place = rand(PLACES);
    const d = dateBetween('1939-09-01', '1945-09-02');
    addObject({
      collectionId: diaryCol,
      kind: 'note',
      title: `${writer.name} — diary entry, ${d.slice(0, 10)}`,
      summary: `Personal entry from near ${place.name}. References ${battle.name}.`,
      content: `# ${writer.name} — ${d.slice(0, 10)}\n\nQuiet morning at ${place.name}. Word from the front concerns ${battle.name}. ${writer.role} duties continue.`,
      tags: ['diary'],
      createdAt: d,
    });
    count++;
  }

  // Battlefield dispatches (~400)
  for (let i = 0; i < 400; i++) {
    const battle = rand(BATTLES);
    const sender = rand(PEOPLE);
    const place = rand(PLACES);
    const unit = rand(UNITS);
    const d = dateBetween(battle.start, battle.end);
    addObject({
      collectionId: dispatchCol,
      kind: 'doc',
      title: `Dispatch from ${battle.name} — ${d.slice(0, 10)}`,
      summary: `${sender.name} reports situation near ${place.name}. ${unit} engaged.`,
      content: `# Battlefield dispatch\n\n**From:** ${sender.name}\n**Date:** ${d.slice(0, 10)}\n**Re:** ${battle.name}\n**Location:** ${place.name}\n**Unit:** ${unit}\n\nStatus update from the field — operation ongoing.`,
      tags: ['dispatch', battle.theater.toLowerCase().replace(/[^a-z]+/g, '-')],
      createdAt: d,
    });
    count++;
  }

  // Telegrams (~400)
  for (let i = 0; i < 400; i++) {
    const from = rand(PLACES);
    const to = rand(PLACES);
    const sender = rand(PEOPLE);
    const recipient = rand(PEOPLE);
    const battle = rand(BATTLES);
    const d = dateBetween('1939-09-01', '1945-09-02');
    addObject({
      collectionId: telegramCol,
      kind: 'note',
      title: `Telegram: ${from.name} → ${to.name}, ${d.slice(0, 10)}`,
      summary: `${sender.name} to ${recipient.name}. Subject: ${battle.name}.`,
      content: `# Telegram\n\n**From:** ${sender.name} (${from.name})\n**To:** ${recipient.name} (${to.name})\n**Date:** ${d.slice(0, 10)}\n**Subject:** ${battle.name}\n\nProceed as instructed.`,
      tags: ['telegram'],
      createdAt: d,
    });
    count++;
  }

  // Field reports on operations (~270)
  for (let i = 0; i < 270; i++) {
    const op = rand(OPERATIONS);
    const sender = rand(PEOPLE);
    const place = rand(PLACES);
    const unit = rand(UNITS);
    const d = dateBetween('1940-01-01', '1945-08-31');
    addObject({
      collectionId: dispatchCol,
      kind: 'doc',
      title: `Field report: ${op.name} — ${d.slice(0, 10)}`,
      summary: `${sender.name} reporting on ${op.name} from near ${place.name}. ${unit} involved.`,
      content: `# Field report\n\n**Operation:** ${op.name}\n**Reporter:** ${sender.name}\n**Date:** ${d.slice(0, 10)}\n**Location:** ${place.name}\n**Unit:** ${unit}\n\n${op.desc}.`,
      tags: ['field-report'],
      createdAt: d,
    });
    count++;
  }

  db.exec('COMMIT');
  const elapsed = Date.now() - t0;
  console.log(`✔ Inserted ${count} objects in ${elapsed} ms.`);
  console.log(`Total in DB: ${db.prepare('SELECT COUNT(*) AS n FROM objects').get().n}`);
} catch (err) {
  db.exec('ROLLBACK');
  console.error('Seed failed:', err);
  process.exit(1);
} finally {
  db.close();
}
