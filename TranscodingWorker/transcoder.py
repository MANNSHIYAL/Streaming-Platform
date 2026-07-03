import os
import json
import subprocess
import mysql.connector
from kafka import KafkaConsumer, KafkaProducer
from minio import Minio


# Dynamic variables extracted directly from your compose network configurations
RAW_BUCKET = "raw-videos"
HLS_BUCKET = "videos-transcoded"

print("Started Consuming!!!")

CONSUMER_TOPIC = os.getenv("KAFKA_CONSUMER_TOPIC", "video-transcode-jobs")
PRODUCER_TOPIC = os.getenv("KAFKA_PRODUCER_TOPIC", "video-processing-notifications")
KAFKA_BROKER = os.getenv("KAFKA_BROKER", "kafka:9092")

MINIO_CLIENT = Minio(
    os.getenv("MINIO_ENDPOINT", "minio:9000"),
    access_key=os.getenv("MINIO_ACCESS_KEY", "admin"),
    secret_key=os.getenv("MINIO_SECRET_KEY", "securepassword"),
    secure=False
)

MYSQL_CONFIG = {
    'host': os.getenv("MYSQL_HOST", "mysql_db"),
    'database': os.getenv("MYSQL_DATABASE", "videodb"),
    'user': 'root',
    'password': os.getenv("MYSQL_PASSWORD", "securepassword")
}

def update_db_status(object_name, status, manifest_url=None):
    conn = mysql.connector.connect(**MYSQL_CONFIG)
    cur = conn.cursor()
    # Note: Make sure the `VideoRecord` table exists inside your `videodb` (or target schema)
    if manifest_url:
        query = 'UPDATE `VideoRecord` SET `Status` = %s, `HlsManifestUrl` = %s, `UpdatedAt` = NOW() WHERE `MinioObjectName` = %s'
        cur.execute(query, (status, manifest_url, object_name))
    else:
        query = 'UPDATE `VideoRecord` SET `Status` = %s, `UpdatedAt` = NOW() WHERE `MinioObjectName` = %s'
        cur.execute(query, (status, object_name))
    conn.commit()
    cur.close()
    conn.close()

# # Cluster Group Setup
# consumer = KafkaConsumer(
#     CONSUMER_TOPIC, 
#     bootstrap_servers=[KAFKA_BROKER], 
#     # group_id="video-transcoder-cluster",
#     auto_offset_reset='earliest',
#     value_deserializer=lambda x: json.loads(x.decode('utf-8'))
# )

print("Connecting to Kafka cluster...", flush=True)

try:
    consumer = KafkaConsumer(
        CONSUMER_TOPIC, 
        bootstrap_servers=[KAFKA_BROKER], 
        auto_offset_reset='earliest',
        request_timeout_ms=5000,      # Kill connection attempt if it freezes for 5 seconds
        # api_version=(0, 10, 0),       # Forces library to bypass automatic version checking freeze
        value_deserializer=lambda x: json.loads(x.decode('utf-8'))
    )
    print("Kafka connection established successfully!", flush=True)
except Exception as conn_err:
    print(f"CRITICAL: Failed to connect to Kafka broker: {conn_err}", flush=True)
    sys.exit(1)

producer = KafkaProducer(
    bootstrap_servers=[KAFKA_BROKER],
    value_serializer=lambda v: json.dumps(v).encode('utf-8')
)

print("Transcoder worker connected to streaming network stack. Listening for messages...")

# for message in consumer:
#     print(f"Received raw data event payload: {message.value}", flush=True)
#     event_data = message.value
#     records = event_data.get('Records', [])
#     for record in records:
#         upload_id = event_data.get('UploadId')
#         raw_bucket = event_data.get('BucketName')
#         object_name = event_data.get('ObjectName')
#         update_db_status(object_name, "Processing")
        
#         local_input = f"temp_{object_name}"
#         output_dir = f"hls_{object_name}"
#         os.makedirs(output_dir, exist_ok=True)

#         try:
#             MINIO_CLIENT.fget_object(RAW_BUCKET, object_name, local_input)

#             # 1. Check if the video has an audio stream using ffprobe
#             probe_cmd = f"ffprobe -v error -select_streams a -show_entries stream=index -of json {local_input}"
#             probe_result = subprocess.run(probe_cmd, shell=True, capture_output=True, text=True)
#             has_audio = bool(json.loads(probe_result.stdout).get('streams'))

#             # 2. Dynamically build the FFmpeg parameters based on audio availability
#             if has_audio:
#                 audio_maps = "-map a:0 -c:a aac -b:a:0 192k -map a:0 -c:a aac -b:a:1 128k -map a:0 -c:a aac -b:a:2 96k "
#                 stream_mapping = "v:0,a:0 v:1,a:1 v:2,a:2"
#             else:
#                 audio_maps = ""  # No audio flags if video is silent
#                 stream_mapping = "v:0 v:1 v:2"

#             # 3. Execute the variant HLS stream transcode command
#             ffmpeg_cmd = (
#                 f"ffmpeg -i {local_input} -y "
#                 f"-filter_complex \"[0:v]split=3[v1][v2][v3]; "
#                 f"[v1]scale=w=1920:h=1080[v1out]; [v2]scale=w=1280:h=720[v2out]; [v3]scale=w=854:h=480[v3out]\" "
#                 f"-map \"[v1out]\" -c:v:0 libx264 -b:v:0 5000k -maxrate:v:0 5350k -bufsize:v:0 7500k "
#                 f"-map \"[v2out]\" -c:v:1 libx264 -b:v:1 3000k -maxrate:v:1 3210k -bufsize:v:1 4500k "
#                 f"-map \"[v3out]\" -c:v:2 libx264 -b:v:2 1000k -maxrate:v:2 1070k -bufsize:v:2 1500k "
#                 f"{audio_maps}"
#                 f"-f hls -hls_time 5 -hls_playlist_type vod "
#                 f"-master_pl_name master.m3u8 "
#                 f"-var_stream_map \"{stream_mapping}\" "
#                 f"\"{output_dir}/stream_%v.m3u8\""
#             )
            
#             print(f"Executing FFmpeg transcoding for: {object_name} (Has Audio: {has_audio})", flush=True)
#             subprocess.run(ffmpeg_cmd, shell=True, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

#             # 4. Upload multi-bitrate chunks to HLS MinIO Bucket
#             for root, _, files in os.walk(output_dir):
#                 for file in files:
#                     local_filepath = os.path.join(root, file)
#                     minio_target_path = f"{object_name}/{file}"
#                     MINIO_CLIENT.fput_object(HLS_BUCKET, minio_target_path, local_filepath)

#             # 5. DB Callback and Notification update
#             final_manifest_url = f"http://storage.livestreaming.local/{HLS_BUCKET}/{object_name}/master.m3u8"
#             update_db_status(object_name, "Completed", final_manifest_url)
            
#             transcode_success_event = {
#                 "object_name": object_name,
#                 "status": "Completed",
#                 "manifest_url": final_manifest_url
#             }
#             producer.send(PRODUCER_TOPIC, value=transcode_success_event)
#             producer.flush()
            
#             MINIO_CLIENT.remove_object(RAW_BUCKET, object_name)

#         except subprocess.CalledProcessError as ffmpeg_err:
#             error_details = ffmpeg_err.stderr.decode() if ffmpeg_err.stderr else "Unknown FFmpeg error"
#             print(f"FFmpeg binary execution failed: {error_details}", flush=True)
#             update_db_status(object_name, "Failed")
            
#         except Exception as e:
#             print(f"Failed handling transcode execution: {e}", flush=True)
#             update_db_status(object_name, "Failed")
            
#         finally:
#             if os.path.exists(local_input): os.remove(local_input)
#             if os.path.exists(output_dir): subprocess.run(f"rm -rf {output_dir}", shell=True)


# Fixed loop syntax variable mismatch (messages -> message)
import re
import os
import json
import subprocess

# Fixed loop syntax variable mismatch
for message in consumer:
    try:
        # Determine if message is pre-deserialized or raw stream bytes
        if isinstance(message.value, (dict, list)):
            event_data = message.value
        else:
            raw_payload = message.value.decode('utf-8') if isinstance(message.value, bytes) else message.value
            event_data = json.loads(raw_payload)
            
        print(f"\n--- New Transcode Job Packet Dispatched: {event_data}", flush=True)
        
        # 1. Extract clean properties matching your C# serialization contract directly
        video_id = event_data.get('Id')
        upload_id = event_data.get('UploadId')
        raw_bucket = event_data.get('BucketName', RAW_BUCKET)
        object_name = event_data.get('ObjectName')
        video_name = event_data.get('Title')
        
        if not object_name:
            print("Skipping message parsing cycle: ObjectName property missing in payload.", flush=True)
            continue

        print(f"Initializing media pipeline for tracking entity: {object_name}", flush=True)
        
        # 2. Database updates match the table structure (updates via MinioObjectName string validation)
        update_db_status(object_name, "Processing")
        
        # Set up transient machine disk workspace folders
        local_input = f"temp_{object_name}"
        output_dir = f"hls_{object_name}"
        os.makedirs(output_dir, exist_ok=True)

        try:
            # 3. Pull source asset directly from your input storage bucket
            print(f"Downloading raw asset tracking block from bucket: '{raw_bucket}'", flush=True)
            try:
                # Check if the object exists
                MINIO_CLIENT.stat_object(raw_bucket, object_name)
                
                # Object exists, proceed to download
                MINIO_CLIENT.fget_object(raw_bucket, object_name, local_input)
                print("Object successfully downloaded.")
            except S3Error as e:
                if e.code == "NoSuchKey":
                    print(f"Error: The object '{object_name}' does not exist in bucket '{raw_bucket}'.")
                else:
                    print(f"An error occurred: {e}")

            # --- EXTRA STEP: Extract total video duration using ffprobe ---
            duration_cmd = f"ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nocorrectors=1 {local_input}"
            duration_result = subprocess.run(duration_cmd, shell=True, capture_output=True, text=True)
            try:
                total_duration = float(duration_result.stdout.strip())
                print(f"Target video duration: {total_duration:.2s} seconds.", flush=True)
            except Exception:
                total_duration = None
                print("Warning: Could not fetch video duration for precise percentage logging. Defaulting to fallback logging.", flush=True)

            # Check if the video has an audio stream using ffprobe
            probe_cmd = f"ffprobe -v error -select_streams a -show_entries stream=index -of json {local_input}"
            probe_result = subprocess.run(probe_cmd, shell=True, capture_output=True, text=True)
            
            has_audio = False
            if probe_result.stdout:
                try:
                    has_audio = bool(json.loads(probe_result.stdout).get('streams'))
                except Exception:
                    pass

            # Dynamically build the FFmpeg parameters based on audio availability
            if has_audio:
                audio_maps = "-map a:0 -c:a aac -b:a:0 192k -map a:0 -c:a aac -b:a:1 128k -map a:0 -c:a aac -b:a:2 96k "
                stream_mapping = "v:0,a:0 v:1,a:1 v:2,a:2"
            else:
                audio_maps = ""  # No audio flags if video is silent
                stream_mapping = "v:0 v:1 v:2"

            # Execute the variant multi-bitrate HLS stream transcode command string
            # CRITICAL OPTION ADDED: -progress pipe:1 outputs clean parseable lines to stdout
            ffmpeg_cmd = (
                f"ffmpeg -i {local_input} -y "
                f"-filter_complex \"[0:v]split=3[v1][v2][v3]; "
                f"[v1]scale=w=1920:h=1080[v1out]; [v2]scale=w=1280:h=720[v2out]; [v3]scale=w=854:h=480[v3out]\" "
                f"-map \"[v1out]\" -c:v:0 libx264 -b:v:0 5000k -maxrate:v:0 5350k -bufsize:v:0 7500k "
                f"-map \"[v2out]\" -c:v:1 libx264 -b:v:1 3000k -maxrate:v:1 3210k -bufsize:v:1 4500k "
                f"-map \"[v3out]\" -c:v:2 libx264 -b:v:2 1000k -maxrate:v:2 1070k -bufsize:v:2 1500k "
                f"{audio_maps}"
                f"-f hls -hls_time 5 -hls_playlist_type vod "
                f"-master_pl_name master.m3u8 "
                f"-var_stream_map \"{stream_mapping}\" "
                f"-progress pipe:1 " 
                f"\"{output_dir}/stream_%v.m3u8\""
            )
            
            print(f"Executing FFmpeg transcoding for: {object_name} (Has Audio: {has_audio})", flush=True)
            
            # Use Popen to intercept the real-time processing lines
            process = subprocess.Popen(
                ffmpeg_cmd, 
                shell=True, 
                stdout=subprocess.PIPE, 
                stderr=subprocess.STDOUT, 
                universal_newlines=True
            )

            # Parse lines dynamically to extract out percentage completion metrics
            time_pattern = re.compile(r"out_time_ms=(\d+)")
            last_percentage = -1

            while True:
                line = process.stdout.readline()
                if not line and process.poll() is not None:
                    break
                
                if total_duration and total_duration > 0:
                    match = time_pattern.search(line)
                    if match:
                        # FFmpeg progress reports time directly in microseconds (out_time_ms)
                        current_time_seconds = float(match.group(1)) / 1000000.0
                        percentage = min(int((current_time_seconds / total_duration) * 100), 100)
                        
                        # Throttle logs to only print when a whole number percentage increments
                        if percentage > last_percentage:
                            print(f"[{object_name}] Transcoding Progress: {percentage}% complete", flush=True)
                            last_percentage = percentage

            # Check if execution finished cleanly or exploded with a bad exit code
            if process.returncode != 0:
                raise subprocess.CalledProcessError(process.returncode, ffmpeg_cmd)

            # 4. Upload multi-bitrate HLS adaptive segments (.ts and .m3u8) to destination HLS MinIO Bucket
            print("Uploading transcoded HLS stream segments to distribution bucket...", flush=True)
            for root, _, files in os.walk(output_dir):
                for file in files:
                    local_filepath = os.path.join(root, file)
                    minio_target_path = f"{object_name}/{file}"
                    MINIO_CLIENT.fput_object(HLS_BUCKET, minio_target_path, local_filepath)

            # Compute the absolute streaming playback endpoint locator url string
            final_manifest_url = f"http://storage.livestreaming.local/{HLS_BUCKET}/{object_name}/master.m3u8"
            
            # Finalize state management transformations inside your database
            update_db_status(object_name, "Completed", final_manifest_url)
            
            # 5. Broadcast outbound event notifications back to your system architecture
            transcode_success_event = {
                "Id": video_id,
                "UploadId": upload_id,
                "ObjectName": object_name,
                "Status": "Completed",
                "Title": video_name,
                "ManifestUrl": final_manifest_url
            }
            producer.send(PRODUCER_TOPIC, value=transcode_success_event)
            producer.flush()
            print(f"Notification event sent to topic: {PRODUCER_TOPIC}", flush=True)
            
            # Wipe raw high-capacity file ingestion footprint out of raw bucket storage
            MINIO_CLIENT.remove_object(raw_bucket, object_name)
            print(f"Processing complete. Raw storage freed for key: {object_name}", flush=True)

        except subprocess.CalledProcessError as ffmpeg_err:
            print(f"FFmpeg pipeline task aborted with exit code {ffmpeg_err.returncode}", flush=True)
            update_db_status(object_name, "Failed")
            
        except Exception as inner_ex:
            print(f"Unexpected operational loop crash: {inner_ex}", flush=True)
            update_db_status(object_name, "Failed")
            
        finally:
            # Clean container disk space workspaces immediately to avoid space saturation issues
            if os.path.exists(local_input): 
                os.remove(local_input)
            if os.path.exists(output_dir): 
                subprocess.run(f"rm -rf {output_dir}", shell=True)

    except Exception as parse_error:
        print(f"Fatal Event: Outermost packet deserialization wrapper failed: {parse_error}", flush=True)
