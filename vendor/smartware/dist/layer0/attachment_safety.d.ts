export interface AttachmentCheckResult {
    allowed: boolean;
    reason?: string;
}
export declare function checkAttachmentSafety(filename: string, sizeBytes: number): AttachmentCheckResult;
export declare function isTextExtractable(mimeType: string): boolean;
//# sourceMappingURL=attachment_safety.d.ts.map