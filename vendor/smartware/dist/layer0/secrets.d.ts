export interface SecretDetectionResult {
    detected: boolean;
    type?: string;
    location?: string;
    snippet?: string;
}
export declare function detectSecrets(content: string | object): SecretDetectionResult;
//# sourceMappingURL=secrets.d.ts.map