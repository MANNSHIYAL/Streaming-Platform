namespace BlobUpload.Models
{
    public enum VideoStatus
    {
        Uploading,   // Frontend is pushing pieces to MinIO
        Pending,     // File assembled in MinIO; waiting for worker
        Processing,  // Python transcoder is executing FFmpeg
        Completed,   // HLS variants generated and stored
        Failed       // Transcoding runtime error encountered
    }
}
