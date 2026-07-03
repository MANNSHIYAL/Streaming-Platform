import { Component } from '@angular/core';
import { UploadService } from '../../core/upload.service';
import { InitUploadRequest } from '../../models/video.model';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-upload',
  imports: [FormsModule],
  templateUrl: './upload.component.html',
  styleUrl: './upload.component.scss'
})
export class UploadComponent {
  isUploading = false;
  uploadSuccess = false;
  isDragOver = false;
  uploadError: string | null = null;

  // Keep track of the active binary file for the service pipeline
  selectedFile: File | null = null;

  // Initialise the interface payload contract
  uploadData: InitUploadRequest = {
    title: '',
    fileName: '',
    totalChunks: 0,
    description: ''
  };

  constructor(private uploadService: UploadService) { }

  // 1. Stage File via Native Browser File Input Explorer
  onFileSelected(event: Event): void {
    const element = event.currentTarget as HTMLInputElement;
    if (element.files && element.files.length > 0) {
      this.assignFileAndShowForm(element.files[0]);
    }
    element.value = ''; // Clear file input element buffer
  }

  private assignFileAndShowForm(file: File): void {
    this.uploadError = null;
    this.selectedFile = file; // Form shows instantly now

    this.uploadData.fileName = file.name;
    this.uploadData.title = file.name.replace(/\.[^/.]+$/, ""); // Pre-fill title text field
  }

  // Drag over target container zone area
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  // Drag leaves target container zone area
  onDragLeave(): void {
    this.isDragOver = false;
  }

  // 2. Stage File via Native Drag & Drop Area
  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;

    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      if (file.type.startsWith('video/')) {
        this.assignFileAndShowForm(file);
      } else {
        this.uploadError = 'Invalid file type. Please upload a video file.';
      }
    }
  }


  // 4. Orchestrate Service Execution Using Form Data
  async startUploadProcessing(): Promise<void> {
    if (!this.selectedFile || this.uploadData.title.length <= 0 || this.uploadData.description.length <= 0) return;

    this.isUploading = true;
    this.uploadSuccess = false;
    this.uploadError = null;

    try {
      // Pass your formal metadata payload down directly into the resumable pipeline service
      await this.uploadService.uploadResumableVideo(this.selectedFile, this.uploadData);
      this.uploadSuccess = true;
    } catch (error) {
      console.error('Pipeline Execution Error:', error);
      this.uploadError = 'Upload pipeline broken. Storage cluster rejected chunks.';
    } finally {
      this.isUploading = false;
    }
  }

  // Reset complete component state variables
  resetUpload(): void {
    this.selectedFile = null;
    this.isUploading = false;
    this.uploadSuccess = false;
    this.uploadError = null;
    this.uploadData = {
      title: '',
      fileName: '',
      totalChunks: 0,
      description: ''
    };
  }
}
