import type { Frontmatter } from './types.js';
/**
 * Parse YAML frontmatter from a markdown file's string content.
 * Returns { frontmatter, body } or null if no frontmatter found.
 */
export declare function parseFrontmatter(raw: string): {
    frontmatter: Frontmatter;
    body: string;
} | null;
/**
 * Serialise frontmatter + body back to a full markdown string.
 */
export declare function serialiseFrontmatter(frontmatter: Frontmatter, body: string): string;
/**
 * Validate that a frontmatter object has all required fields.
 */
export declare function validateFrontmatter(fm: Partial<Frontmatter>): fm is Frontmatter;
//# sourceMappingURL=frontmatter.d.ts.map