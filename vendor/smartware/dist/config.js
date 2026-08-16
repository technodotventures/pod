// Instance configuration loader
import fs from 'fs';
import path from 'path';
import { ulid } from 'ulid';
import { SMARTWARE_VERSION } from './version.js';
import { ensurePrivateDirectory, writePrivateFile } from './storage/private-fs.js';
const DEFAULT_CONFIG = {
    owner_id: 'user:local',
    version: SMARTWARE_VERSION,
    scopes: [
        { id: 'self', parent: null, visibility_default: 'private' },
        { id: 'workspace', parent: null, visibility_default: 'workspace' },
        { id: 'project:default', parent: 'workspace', visibility_default: 'scope' },
    ],
    grants: [],
    llm: {
        provider: 'none',
        model: '',
    },
    staleness: {
        default_half_life_days: 90,
        scope_overrides: {
            self: 365,
            'project:*': 30,
        },
        stale_threshold: 0.3,
    },
};
export function loadConfig(dataDir) {
    const configPath = path.join(dataDir, 'config.json');
    if (!fs.existsSync(configPath)) {
        throw new Error(`Config not found at ${configPath}. Run init first.`);
    }
    const raw = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(raw);
}
export function saveConfig(dataDir, config) {
    ensurePrivateDirectory(dataDir);
    const configPath = path.join(dataDir, 'config.json');
    writePrivateFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
}
export function createDefaultConfig(dataDir) {
    const config = {
        ...DEFAULT_CONFIG,
        instance_id: `smartware_${ulid()}`,
        writer_id: `writer_local_${ulid()}`,
        data_dir: dataDir,
    };
    return config;
}
export function getDataDir() {
    return process.env['SMARTWARE_DATA_DIR'] ?? path.join(process.cwd(), 'data');
}
//# sourceMappingURL=config.js.map