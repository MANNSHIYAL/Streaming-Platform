import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment.development';
import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { CompleteUploadRequest, InitResponse, InitUploadRequest, PartProgress } from '../models/video.model';
import { __runInitializers } from 'tslib';
import { concatMap, delay, firstValueFrom, from, map, mergeMap, Observable, toArray } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UploadService {
  private baseURL = environment.apiUrl + 'upload/';
  // private baseURL = environment.apiUrl + 'api/UploadVideo/';

  private readonly CHUNK_SIZE = 10 * 1024 * 1024; // 10MB Chunks

  constructor(private http: HttpClient) { }


  private getPreSignedURL(uploadData: InitUploadRequest): Observable<InitResponse> {

    return this.http.post<InitResponse>(this.baseURL + 'getPreSignedUrl', uploadData).pipe(
      map((value: InitResponse) => {
        return value
      })
    );
  }

  private uploadChunk(url: string, chunkBlob: Blob): Observable<HttpResponse<any>> {
    return this.http.put(url, chunkBlob, {
      observe: 'response',
      responseType: 'text',
      // DO NOT add Content-Type headers unless they were explicitly signed by the backend!
      headers: new HttpHeaders({ 'Content-Type': 'application/octet-stream' })
    });
  }



  async uploadResumableVideo(file: File, uploadData: InitUploadRequest): Promise<void> {
    const FILE_SIZE = file.size;
    uploadData.totalChunks = Math.ceil(FILE_SIZE / this.CHUNK_SIZE);



    return new Promise((resolve, reject) => {
      this.getPreSignedURL(uploadData).pipe(
        concatMap((initResponse: InitResponse) => {
          const { uploadId, objectName, missingChunks } = initResponse;

          // 1. Create a simple array of missing part numbers (no file slicing yet)
          const missingPartNumbers: number[] = [];
          for (let partNumber = 1; partNumber <= uploadData.totalChunks; partNumber++) {
            if (missingChunks[partNumber]) {
              missingPartNumbers.push(partNumber);
            } else {
              console.log(`Part ${partNumber} verified on storage. Skipping.`);
            }
          }

          // 2. If no chunks are missing, skip straight to completion
          if (missingPartNumbers.length === 0) {
            return from(Promise.resolve({ uploadId, objectName, parts: [] }));
          }

          // 3. Process part numbers stream dynamically
          return from(missingPartNumbers).pipe(
            mergeMap((partNumber: number): Observable<PartProgress> => {
              // File slicing and HTTP creation happen strictly when mergeMap pulls the item!
              const start = (partNumber - 1) * this.CHUNK_SIZE;
              const end = Math.min(start + this.CHUNK_SIZE, FILE_SIZE);
              const chunkBlob: Blob = file.slice(start, end);
              const uploadUrl = missingChunks[partNumber];

              return this.uploadChunk(uploadUrl, chunkBlob).pipe(
                map((response: HttpResponse<any>) => {
                  const etag = response.headers.get('ETag')?.replace(/"/g, '') || '';
                  return { partNumber, eTag: etag };
                })
              );
            }, 3), // Strictly manages 3 active HTTP uploads at a time
            toArray(), // Aggregates all emitted ETags once everything finishes
            map((progressedParts) => ({
              uploadId,
              objectName,
              parts: progressedParts.sort((a, b) => a.partNumber - b.partNumber) // Keeps list ordered
            }))
          );
        }),
        // 4. Send compilation payload to backend
        concatMap((completePayload: CompleteUploadRequest) => this.uploadChunkComplete(completePayload))
      ).subscribe({
        next: (res: any) => {
          console.log("Streaming ingest pipeline configured completely!", res);
          resolve();
        },
        error: (err: any) => {
          console.error("Upload pipeline failed:", err);
          reject(err);
        }
      });
    });
  }


  // Ensure this returns an Observable so it can be chained
  private uploadChunkComplete(completeUpload: CompleteUploadRequest): Observable<any> {
    return this.http.post(this.baseURL + 'compileFile', completeUpload);
  }

  //   private uploadChunkComplete(completeUpload: CompleteUploadRequest) {
  //     return this.http.post(this.baseURL + 'compileFile', completeUpload).subscribe({
  //       next: (value: any) => {
  //         console.log(value.message);
  //       },
  //       error: (e: any) => {
  //         console.error(e);
  //       }
  //     });
  //   }



  // async uploadResumableVideo(file: File): Promise<void> {
  //   const FILE_SIZE = file.size;
  //   const totalChunks = Math.ceil(FILE_SIZE / this.CHUNK_SIZE);

  //   try {
  //     console.log(`Initializing upload session for: ${file.name} (${totalChunks} total chunks expected)`);
  //     const initResponse = await firstValueFrom(this.getPreSignedURL(file, totalChunks));
  //     const { uploadId, objectName, missingChunks } = initResponse;

  //     const finalizedPartsList: PartProgress[] = [];

  //     // Loop through all chunks sequentially
  //     for (let partNumber = 1; partNumber <= totalChunks; partNumber++) {
  //       const uploadUrl = missingChunks[partNumber];

  //       if (!uploadUrl) {
  //         console.log(`Part ${partNumber} verified on storage. Skipping network upload.`);
  //         const existingETag = (initResponse as any).existingETags?.[partNumber] || '';
  //         finalizedPartsList.push({ partNumber, eTag: existingETag });
  //         continue;
  //       }

  //       const start = (partNumber - 1) * this.CHUNK_SIZE;
  //       const end = Math.min(start + this.CHUNK_SIZE, FILE_SIZE);
  //       const chunkBlob: Blob = file.slice(start, end);

  //       console.log(`[Uploading] Part ${partNumber}/${totalChunks} | Byte Slices: ${start} - ${end}`);

  //       // CRITICAL FIX: Use native browser fetch to bypass any Angular HttpClient Interceptors
  //       const response = await fetch(uploadUrl, {
  //         method: 'PUT',
  //         body: chunkBlob,
  //         headers: {
  //           'Content-Type': 'application/octet-stream'
  //         }
  //       });

  //       if (!response.ok) {
  //         throw new Error(`Chunk upload failed for part ${partNumber}. Status: ${response.status}`);
  //       }

  //       // Fetch reads headers using lowercase keys natively
  //       const rawEtag = response.headers.get('etag')?.replace(/"/g, '') || '';
  //       console.log(`[Success] Part ${partNumber} processed cleanly. ETag: ${rawEtag}`);

  //       finalizedPartsList.push({ partNumber, eTag: rawEtag });
  //     }

  //     finalizedPartsList.sort((a, b) => a.partNumber - b.partNumber);

  //     const completePayload: CompleteUploadRequest = {
  //       uploadId: uploadId,
  //       objectName: objectName,
  //       parts: finalizedPartsList
  //     };

  //     console.log("SENDING FINAL COMPILE PAYLOAD TO BACKEND:", JSON.stringify(completePayload, null, 2));

  //     const compileResult = await firstValueFrom(this.uploadChunkComplete(completePayload));
  //     console.log("Streaming ingest pipeline configured completely!", compileResult);

  //   } catch (error) {
  //     console.error("Upload pipeline hit a fatal error:", error);
  //     throw error;
  //   }
  // }
}
//   async uploadResumableVideo(file: File): Promise<void> {
//     const FILE_SIZE = file.size;

//     const totalChunks = Math.ceil(FILE_SIZE / this.CHUNK_SIZE);
//     let initResponse: InitResponse = {
//       uploadId: '',
//       objectName: '',
//       missingChunks: {}
//     };
//     const progressedParts: PartProgress[] = [];
//     this.getPreSignedURL(file, totalChunks).subscribe({
//       next: (value: InitResponse) => {
//         const { uploadId, objectName, missingChunks } = value;
//         initResponse.uploadId = uploadId;
//         initResponse.objectName = objectName;
//         // 2. Upload only chunks that are missing in MinIO
//         for (let partNumber = 1; partNumber <= totalChunks; partNumber++) {
//           const start = (partNumber - 1) * this.CHUNK_SIZE;
//           const end = Math.min(start + this.CHUNK_SIZE, FILE_SIZE);

//           // If partNumber is missing from backend dictionary, it was already completed!
//           if (!missingChunks[partNumber]) {
//             console.log(`Part ${partNumber} already verified on storage cluster. Skipping.`);
//             continue;
//           }

//           const chunkBlob: Blob = file.slice(start, end);

//           // Upload slice straight to cloud architecture layer
//           // const uploadResponse = await fetch(missingChunks[partNumber], {
//           //   method: 'PUT',
//           //   body: chunkBlob
//           // });

//           this.uploadChunk(missingChunks[partNumber], chunkBlob).subscribe({
//             next: (response: HttpResponse<any>) => {
//               const etag = response.headers.get('ETag');
//               if (etag) {
//                 progressedParts.push({
//                   partNumber: partNumber,
//                   eTag: etag.replace(/"/g, '')
//                 });
//               }

//             },
//             error: (e: any) => {
//               console.error(e);
//             }
//           })





//           // // 1. Initialize or check for existing session
//           // const response = await fetch('/api/video-ingest/resume-or-init', {
//           //   method: 'POST',
//           //   headers: { 'Content-Type': 'application/json' },
//           //   body: JSON.stringify({ fileName: file.name, totalChunks: totalChunks })
//           // });


//         }

//       },
//       complete: () => {
//         const completeUpload: CompleteUploadRequest = {
//           uploadId: initResponse.uploadId,
//           objectName: initResponse.objectName,
//           parts: progressedParts
//         }

//         this.uploadChunkComplete(completeUpload);
//       },
//       error: (e: any) => {
//         console.error(e);
//       }
//     });


//     // 3. Assemble and trigger pipeline
//     // await fetch('/api/video-ingest/complete', {
//     //   method: 'POST',
//     //   headers: { 'Content-Type': 'application/json' },
//     //   body: JSON.stringify({ uploadId: uploadId, objectName: objectName, parts: completedParts })
//     // });

//     console.log("Streaming ingest pipeline configured completely!");
//   }
