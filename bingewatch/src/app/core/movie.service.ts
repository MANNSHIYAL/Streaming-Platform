import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment.development';
import { Video } from '../models/video.model';

@Injectable({
  providedIn: 'root'
})
export class MovieService {
  private baseURL = environment.apiUrl + 'movie/';
  constructor(private http: HttpClient) { }

  getMovies() {
    return this.http.get<Video[]>(this.baseURL + 'videos');
  }

  getSelectedMovie(id: string) {
    return this.http.get<Video>(this.baseURL + id);
  }

  uploadVideo(formData: FormData) {
    return this.http.post(`${environment.apiUrl}${environment.upload}`, formData, {
      reportProgress: true,
      observe: 'events'
    });
  }
}
