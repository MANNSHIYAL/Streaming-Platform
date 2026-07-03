namespace BlobUpload.DTOs
{
    public class PreSignedURL
    {
        public string UploadId { get; set; }

        public string ObjectName { get; set; } = string.Empty;

        public Dictionary<int, string> MissingChunks { get; set; } = new();
    }

}
