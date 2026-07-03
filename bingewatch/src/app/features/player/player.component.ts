import { CommonModule, DatePipe } from '@angular/common';
import { AfterViewInit, Component, ElementRef, inject, OnDestroy, OnInit, ViewChild, } from '@angular/core';
import { FormsModule } from '@angular/forms'
import Hls from 'hls.js';
import { QualityLevel } from '../../models/url.model';
import { MovieService } from '../../core/movie.service';
import { ActivatedRoute } from '@angular/router';


@Component({
  selector: 'app-player',
  imports: [CommonModule],
  templateUrl: './player.component.html',
  styleUrl: './player.component.scss'
})
export class PlayerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('videoPlayer') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('progressBar') progressBar!: ElementRef<HTMLDivElement>;

  private hls!: Hls;
  private movieId: string = '';

  private route = inject(ActivatedRoute);
  private movieService = inject(MovieService);

  // Player States
  isPlaying = false;
  isMuted = true;
  isBuffering = true; // Start as buffering while fetching API data
  isDragging = false;
  progress = 0;
  currentTime = 0;
  duration = 0;

  // Hover Thumbnail Assets
  showThumbnail = false;
  hoverX = 0;
  hoverTimeLabel = '00:00';
  spriteUrl = '';
  thumbWidth = 160;
  thumbHeight = 90;
  thumbX = 0;
  thumbY = 0;

  // Quality System
  availableQualities: QualityLevel[] = [];
  currentLevelIndex = -1;
  currentQualityLabel = 'Auto';
  showQualityMenu = false;

  ngOnInit(): void {
    this.movieId = this.route.snapshot.paramMap.get('id') || '';
    this.fetchVideoConfig();
  }

  ngAfterViewInit(): void {
    this.setupNativeListeners();
  }

  // 1. Fetch data from your API first
  private fetchVideoConfig(): void {
    // const apiEndpoint = 'https://your-backend-api.com'; // Replace with your endpoint

    // this.http.get<VideoMetadata>(apiEndpoint).subscribe({
    //   next: (metadata) => {
    //     this.minioBase = metadata.minioBaseUrl;
    //     this.spriteUrl = this.minioBase + 'sprite.jpg'; // Assign dynamic sprite path

    //     // Initialize player only after data is successfully retrieved
    //     this.initializeHlsPlayer();
    //   },
    //   error: (err) => {
    //     console.error('Failed to load video configuration from API:', err);
    //     this.isBuffering = false;
    //   }
    // });
    const test = 'http://storage.livestreaming.local/videos-transcoded/d49fe03b-f52f-45d5-8fd0-8dd788c010c9_Sample-MP4-Video-File-Download.mp4/master.m3u8'
    this.movieService.getSelectedMovie(this.movieId).subscribe({
      next: (value: any) => {
        this.initializeHlsPlayer(value.hlsManifestUrl);
      }, error: (e: any) => {
        this.initializeHlsPlayer(test);
        console.error(e)
      }
    })
  }

  // 2. Initialize hls.js with the dynamic URL
  private initializeHlsPlayer(masterPlaylistUrl: string): void {
    const video = this.videoElement.nativeElement;

    if (Hls.isSupported()) {
      // --- CONFIGURATION CHANGES ---
      this.hls = new Hls({
        abrEwmaDefaultEstimate: 5000000,
        // Target forward buffer maximum length in seconds.
        // If your chunks are 2 seconds each, 6 seconds targets exactly ~2-3 chunks.
        maxBufferLength: 6,
        // The absolute max cap the buffer can grow to under any condition
        maxMaxBufferLength: 8,
        // Don't keep too many old chunks behind the playhead slider in memory
        backBufferLength: 4
      });

      this.hls.loadSource(masterPlaylistUrl);
      this.hls.attachMedia(video);

      this.hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
        // ONLY update the text label dynamically if the user is in "Auto" mode
        if (this.currentLevelIndex === -1) {
          // Find the matched resolution properties from your availableQualities array
          const autoActiveLevel = this.availableQualities.find(q => q.index === data.level);
          this.currentQualityLabel = autoActiveLevel ? `Auto (${autoActiveLevel.height}p)` : 'Auto';
        }
      });

      this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const levels = this.hls.levels;

        if (levels && levels.length > 0) {
          this.availableQualities = levels.map((level, idx) => {
            let fallbackHeight = 480;
            if (idx === 0) fallbackHeight = 1080;
            else if (idx === 1) fallbackHeight = 720;

            return {
              index: idx,
              height: level.height || fallbackHeight,
              bitrate: level.bitrate
            };
          }).sort((a, b) => b.height - a.height);
        }

        video.play()
          .then(() => this.isPlaying = true)
          .catch((err) => console.warn("Autoplay blocked. Awaiting interaction.", err));
      });

      this.hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
        if (this.currentLevelIndex === -1) {
          const activeLevel = this.availableQualities.find(q => q.index === data.level);
          this.currentQualityLabel = activeLevel ? `Auto (${activeLevel.height}p)` : 'Auto';
        }
      });
    }
    else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = masterPlaylistUrl;
      this.currentQualityLabel = 'Auto';
    }
  }


  private setupNativeListeners(): void {
    const video = this.videoElement.nativeElement;
    video.addEventListener('waiting', () => this.isBuffering = true);
    video.addEventListener('playing', () => this.isBuffering = false);
    video.addEventListener('seeked', () => this.isBuffering = false);
  }

  // --- QUALITY & PLAYER CONTROLS (Keep existing logic unchanged) ---
  changeQuality(levelIndex: number): void {
    if (!this.hls) return;
    // this.isBuffering = true;
    this.currentLevelIndex = levelIndex;
    if (levelIndex === -1) {
      this.hls.currentLevel = -1;
      this.currentQualityLabel = 'Auto';
    } else {
      // this.hls.currentLevel = levelIndex;
      this.hls.loadLevel = levelIndex;
      const explicitLevel = this.availableQualities.find(q => q.index === levelIndex);
      this.currentQualityLabel = explicitLevel ? `${explicitLevel.height}p` : 'Auto';
    }
    this.showQualityMenu = false;
    // this.isBuffering = false;
  }

  toggleQualityMenu(): void { this.showQualityMenu = !this.showQualityMenu; }

  onProgressBarHover(event: MouseEvent): void {
    const rect = this.progressBar.nativeElement.getBoundingClientRect();
    let currentX = event.clientX - rect.left;
    currentX = Math.max(0, Math.min(currentX, rect.width));
    this.hoverX = currentX;
    this.showThumbnail = true;

    const percentage = currentX / rect.width;
    const hoverSeconds = percentage * (this.videoElement.nativeElement.duration || 0);

    const mins = Math.floor(hoverSeconds / 60).toString().padStart(2, '0');
    const secs = Math.floor(hoverSeconds % 60).toString().padStart(2, '0');
    this.hoverTimeLabel = `${mins}:${secs}`;

    const totalThumbnails = Math.floor(hoverSeconds / 5);
    const cols = 5;
    const row = Math.floor(totalThumbnails / cols);
    const col = totalThumbnails % cols;

    this.thumbX = -(col * this.thumbWidth);
    this.thumbY = -(row * this.thumbHeight);

    if (this.isDragging) this.updateVideoTime(percentage);
  }

  hidePreview(): void { this.showThumbnail = false; this.isDragging = false; this.showQualityMenu = false; }

  startScrubbing(event: MouseEvent): void { this.isDragging = true; this.onProgressBarHover(event); }

  stopScrubbing(): void { this.isDragging = false; }

  private updateVideoTime(percentage: number): void {
    const video = this.videoElement.nativeElement;
    video.currentTime = percentage * video.duration;
    this.progress = percentage * 100;
  }

  onTimeUpdate(): void {
    // 2. Clear progress drifting if we are scrubbing or waiting on the network buffer
    if (this.isDragging || this.isBuffering) return;

    const video = this.videoElement.nativeElement;
    this.currentTime = video.currentTime * 1000;

    if (video.duration && video.duration !== Infinity) {
      this.progress = (video.currentTime / video.duration) * 100;
    }
  }
  onLoadedMetadata(): void {
    const nativeVideo = this.videoElement.nativeElement;
    if (nativeVideo.duration && nativeVideo.duration !== Infinity) {
      this.duration = nativeVideo.duration * 1000; // 81166 milliseconds
    }
  }

  togglePlay(): void {
    const video = this.videoElement.nativeElement;
    if (this.isPlaying) { video.pause(); this.isPlaying = false; }
    else { video.play().then(() => this.isPlaying = true); }
  }
  toggleMute(): void { const video = this.videoElement.nativeElement; video.muted = !video.muted; this.isMuted = video.muted; }

  toggleFullscreen(): void {
    const video = this.videoElement.nativeElement;
    if (!document.fullscreenElement) video.requestFullscreen().catch(err => console.error(err));
    else document.exitFullscreen();
  }
  formatTime(milliseconds: number): string {
    if (!milliseconds || isNaN(milliseconds) || milliseconds === Infinity) {
      return '00:00';
    }

    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);

    const formattedMinutes = minutes.toString().padStart(2, '0');
    const formattedSeconds = seconds.toString().padStart(2, '0');

    return `${formattedMinutes}:${formattedSeconds}`;
  }

  ngOnDestroy(): void { if (this.hls) this.hls.destroy(); }
}
