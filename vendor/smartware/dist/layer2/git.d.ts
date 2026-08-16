export declare function ensureGitRepo(wikiDir: string): Promise<void>;
export interface CommitSummary {
    sha: string;
    message: string;
    files: string[];
}
export declare function commitWikiChanges(wikiDir: string, message: string, changedFiles?: string[]): Promise<CommitSummary | null>;
export declare function buildCommitMessage(entityName: string, claimsAdded: number, claimsContested: number): string;
//# sourceMappingURL=git.d.ts.map