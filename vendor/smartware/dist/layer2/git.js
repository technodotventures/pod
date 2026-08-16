// Layer 2 — Git commit on compile
import { simpleGit } from 'simple-git';
import fs from 'fs';
import path from 'path';
export async function ensureGitRepo(wikiDir) {
    if (!fs.existsSync(path.join(wikiDir, '.git'))) {
        const git = simpleGit(wikiDir);
        await git.init();
        await git.addConfig('user.name', 'Smartware');
        await git.addConfig('user.email', 'smartware@local');
        // Initial commit if any files exist
        const files = fs.readdirSync(wikiDir).filter(f => f.endsWith('.md'));
        if (files.length > 0) {
            await git.add('.');
            await git.commit('smartware: initial wiki');
        }
    }
}
export async function commitWikiChanges(wikiDir, message, changedFiles) {
    const git = simpleGit(wikiDir);
    try {
        if (changedFiles && changedFiles.length > 0) {
            // Stage specific files
            for (const f of changedFiles) {
                const rel = path.relative(wikiDir, f);
                await git.add(rel);
            }
        }
        else {
            await git.add('.');
        }
        const status = await git.status();
        if (status.staged.length === 0 && status.modified.length === 0 && status.not_added.length === 0) {
            return null; // Nothing to commit
        }
        // Re-add if needed
        await git.add('.');
        const result = await git.commit(message);
        const files = changedFiles ?? status.staged;
        return {
            sha: result.commit,
            message,
            files,
        };
    }
    catch (err) {
        // If nothing to commit, git throws — return null
        return null;
    }
}
export function buildCommitMessage(entityName, claimsAdded, claimsContested) {
    const parts = [];
    if (claimsAdded > 0)
        parts.push(`+${claimsAdded} claims`);
    if (claimsContested > 0)
        parts.push(`${claimsContested} contested`);
    const suffix = parts.length > 0 ? ` (${parts.join(', ')})` : '';
    return `smartware: compiled ${entityName}${suffix}`;
}
//# sourceMappingURL=git.js.map