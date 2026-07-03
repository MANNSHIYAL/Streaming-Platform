export interface InitUploadRequest {
    title: string,
    fileName: string,
    totalChunks: number,
    description: string
}
export interface InitResponse {
    uploadId: string;
    objectName: string;
    missingChunks: Record<number, string>; // Maps part number to its upload URL
}

export interface PartProgress {
    partNumber: number;
    eTag: string;
}

export interface CompleteUploadRequest {
    uploadId: string,
    objectName: string,
    parts: PartProgress[]
}
export interface Video {
    id: string,
    hlsManifestUrl: string,
    title: string,
    description: string,
    image: string
}