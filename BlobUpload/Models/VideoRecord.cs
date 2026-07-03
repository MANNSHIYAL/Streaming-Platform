using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BlobUpload.Models
{
    public class VideoRecord
    {
        [Key] // Sets this property as the primary key
        [DatabaseGenerated(DatabaseGeneratedOption.None)]
        public Guid Id { get; set; } = Guid.NewGuid();
        public string OriginalFileName { get; set; }
        public string MinioObjectName { get; set; }
        public string UploadId { get; set; }
        public int TotalChunks { get; set; }
        public VideoStatus Status { get; set; } = VideoStatus.Uploading;
        public string? HlsManifestUrl { get; set; } // Points to master.m3u8 once finalized
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}
