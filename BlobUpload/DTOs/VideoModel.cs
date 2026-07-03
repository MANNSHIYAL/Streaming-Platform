using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace BlobUpload.DTOs
{
    public class VideoModel
    {
    }

    public class InitUploadRequest
    {
        public string Title { get; set; }
        public string FileName { get; set; }
        public int TotalChunks { get; set; }
        public string Description { get; set; }
    }

    public class CompleteUploadRequest
    {
        public string UploadId { get; set; }
        public string ObjectName { get; set; }
        public List<PartProgressDto> Parts { get; set; }
    }

    public class PartProgressDto
    {
        public int PartNumber { get; set; }
        public string ETag { get; set; }
    }

    public class Video
    {
        public Guid Id { get; set; }
        public string HlsManifestUrl { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Image { get; set; } = string.Empty;
    }
}
