export interface PreSignedURL {
    uploadId: string,
    objectName: string,
    missingChunks: Record<number, string>;
}
export interface VideoMetadata {
    id: string;
    title: string;
    hlsManifestUrl: string;
}

export interface QualityLevel {
    index: number;
    height: number;
    bitrate: number;
}