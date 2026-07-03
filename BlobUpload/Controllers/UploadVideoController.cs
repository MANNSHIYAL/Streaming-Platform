using System.Text.Json;
using Amazon.S3;
using Amazon.S3.Model;
using BlobUpload.Data;
using BlobUpload.DTOs;
using BlobUpload.Models;
using Confluent.Kafka;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlobUpload.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UploadVideoController(IAmazonS3 s3Client, ApplicationDbContext db, IConfiguration configuration, IProducer<string,string> kafkaProducer ,ILogger<UploadVideoController> logger) : Controller
    {
        private readonly IAmazonS3 _s3Client = s3Client;
        private readonly ApplicationDbContext _db = db; // Your EF Core DB Context
        private const string BucketName = "raw-videos";
        private readonly string _serviceUrl = configuration["AmazonS3Bucket:ServiceURL"] ?? "";
        private readonly string _publicUrl = configuration["AmazonS3Bucket:PublicServiceURL"] ?? "";
        private readonly ILogger<UploadVideoController> _logger = logger;
        private readonly IProducer<string, string> _kafkaProducer = kafkaProducer;
        private readonly string _producerTopic = configuration["Kafka:ProducerTopic"] ?? "";

        [HttpPost("getPreSignedUrl")]
        public async Task<IActionResult> GetUploadSession(InitUploadRequest request)
        {
            _logger.LogTrace("Entering to get the presigned url method");
            string fileName = request.FileName;
            int totalChunks = request.TotalChunks;
            string description = request.Description;
            // 1. Check if an unfinished upload session already exists for this exact file
            var existingSession = await _db.VideoRecord
                .FirstOrDefaultAsync(v => v.OriginalFileName == fileName && v.Status == VideoStatus.Uploading);

            string uploadId = string.Empty;
            string objectName = string.Empty;
            var uploadedPartsIndices = new HashSet<int>();

            if (existingSession != null)
            {
                // Session exists! Fetch chunks MinIO already successfully collected
                uploadId = existingSession.UploadId;
                objectName = existingSession.MinioObjectName;

                var listPartsArgs = new ListPartsRequest
                {
                    BucketName = BucketName,
                    Key = objectName,
                    UploadId = uploadId
                };

                try
                {
                    var listPartsResult = await _s3Client.ListPartsAsync(listPartsArgs);
                    if(listPartsResult != null && listPartsResult.Parts != null)
                    {
                        foreach (PartDetail part in listPartsResult.Parts)
                        {
                            uploadedPartsIndices.Add(part.PartNumber ?? 0); // Keep track of complete indices
                        }
                    }
                    else
                    {
                        uploadedPartsIndices.Add(0);
                    }
                }
                catch (AmazonS3Exception ex) when (ex.ErrorCode == "NoSuchUpload")
                {
                    uploadedPartsIndices.Add(0);
                }
                catch (AmazonS3Exception ex)
                {
                    _logger.LogError("Error occured while fetching the list of uploaded parts.");
                }

                
            }
            else
            {
                // Fresh upload: standard initialization
                objectName = $"{Guid.NewGuid()}_{fileName}";

                var initRequest = new InitiateMultipartUploadRequest
                {
                    BucketName = BucketName,
                    Key = objectName
                };

                var initResponse = await _s3Client.InitiateMultipartUploadAsync(initRequest);

                uploadId = initResponse.UploadId;

                var newVideo = new VideoRecord
                {
                    OriginalFileName = fileName,
                    MinioObjectName = objectName,
                    UploadId = uploadId,
                    TotalChunks = totalChunks,
                    Status = VideoStatus.Uploading,
                    Title = request.Title,
                    Description = description
                };
                _db.VideoRecord.Add(newVideo);
                await _db.SaveChangesAsync();
            }

            // 2. Generate presigned URLs ONLY for chunks that have NOT been uploaded yet
            var remainingUrls = new Dictionary<int, string>();
            for (int partNum = 1; partNum <= totalChunks; partNum++)
            {
                if (uploadedPartsIndices.Contains(partNum)) continue; // Skip already uploaded pieces

                var urlArgs = new GetPreSignedUrlRequest
                {
                    BucketName = BucketName,
                    Key = objectName,
                    Verb = HttpVerb.PUT,
                    Expires = DateTime.UtcNow.AddHours(1),
                    Protocol = Protocol.HTTP,
                    PartNumber = partNum,
                    UploadId = uploadId
                };

                urlArgs.Parameters.Add("uploadId", uploadId);
                urlArgs.Parameters.Add("partNumber", partNum.ToString());

                string presignedUrl = await _s3Client.GetPreSignedURLAsync(urlArgs);
                presignedUrl = presignedUrl.Replace(_serviceUrl,_publicUrl);
                remainingUrls.Add(partNum, presignedUrl);
            }

            PreSignedURL signedURL = new()
            {
                UploadId = uploadId,
                ObjectName = objectName,
                MissingChunks = remainingUrls // Maps PartNumber -> Direct Upload Presigned URL
            };

            return Ok(signedURL);
        }

        [HttpPost("compileFile")]
        public async Task<IActionResult> CompleteUpload([FromBody] CompleteUploadRequest request)
        {
            var video = await _db.VideoRecord.FirstOrDefaultAsync(v => v.UploadId == request.UploadId);
            if (video == null) return NotFound("Upload session not tracked.");

            var s3Parts = request.Parts
                .Select(p => new PartETag{ PartNumber = p.PartNumber, ETag = p.ETag })
                .ToList();
            var completeArgs = new CompleteMultipartUploadRequest()
            {
                BucketName = BucketName,
                Key = request.ObjectName,
                UploadId = request.UploadId,
                PartETags = s3Parts
            };
            _logger.LogInformation("Before Compilation");
            await _s3Client.CompleteMultipartUploadAsync(completeArgs);
            _logger.LogInformation("After Compilation");

            // Update database state to Pending
            video.Status = VideoStatus.Pending;
            video.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            try
            {
                var kafkaMessage = new Message<string, string>
                {
                    Key = video.UploadId, // Best practice: Route events for the same video to the same partition
                    Value = JsonSerializer.Serialize(new
                    {
                        Id = video.Id,
                        UploadId = video.UploadId,
                        BucketName = BucketName,
                        ObjectName = request.ObjectName,
                        Title = video.Title,
                        Status = "Pending",
                        Timestamp = DateTime.UtcNow
                    })
                };

                // Fire-and-forget inside the HTTP pipeline using ProduceAsync
                await _kafkaProducer.ProduceAsync(_producerTopic, kafkaMessage);
            }
            catch (Exception ex)
            {
                // Log the error but don't fail the HTTP response since S3 and DB operations succeeded
                _logger.LogError($"Kafka publication failed for {video.UploadId}: {ex}");
            }

            return Ok(new { Message = "File assembled completely. Processing initialized." });
        }
        [HttpGet("{videoId}")]
        public async Task<IActionResult> getVideoUrl([FromRoute] Guid videoId)
        {
            _logger.LogTrace(videoId.ToString());
            VideoRecord record = await _db.VideoRecord.FirstOrDefaultAsync(p => p.Id == videoId);
            _logger.LogTrace(record == null ? "Null data" : record.Id.ToString());

            if (record == null) 
            {
                return BadRequest(new { Message = "Requested video does not exist." });
            }

            Video video = new Video()
            {
                Id = record.Id,
                Title = record.Title,
                Description = record.Description,
                HlsManifestUrl = record.HlsManifestUrl
            };

            return Ok(video);
        }
        [HttpGet("videos")]
        public async Task<IActionResult> getVideoList()
        {
            var availableVideos = await _db.VideoRecord.Select(video => new Video()
            {
                Id = video.Id,
                Title = video.Title,
                Description = video.Description,
                HlsManifestUrl = video.HlsManifestUrl
            }).ToListAsync();

            return Ok(availableVideos);
        }
    }

}
