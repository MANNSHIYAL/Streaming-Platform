import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { trigger, transition, style, animate, query, group } from '@angular/animations'
import { MovieService } from '../../core/movie.service';
import { Router, RouterLink, RouterModule } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { Video } from '../../models/video.model';

@Component({
  selector: 'app-browse',
  standalone: true,
  imports: [CommonModule, RouterModule],
  animations: [
    trigger('hoverScale', [
      transition(':enter', [style({ transform: 'scale(1)' }), animate('200ms', style({ transform: 'scale(1.08)' }))])
    ]),
    trigger('fadeAnimation', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('600ms ease-in', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('600ms ease-out', style({ opacity: 0 }))
      ])
    ]),
    trigger('slideAnimation', [
      transition(':increment, * => *', [
        query(':enter, :leave', [
          style({
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%'
          })
        ], { optional: true }),
        query(':enter', [
          style({ transform: 'translateX(100%)', opacity: 0 })
        ], { optional: true }),
        group([
          query(':leave', [
            animate('700ms cubic-bezier(0.4, 0, 0.2, 1)',
              style({ transform: 'translateX(-100%)', opacity: 0 })
            )
          ], { optional: true }),
          query(':enter', [
            animate('700ms cubic-bezier(0.4, 0, 0.2, 1)',
              style({ transform: 'translateX(0%)', opacity: 1 })
            )
          ], { optional: true })
        ])
      ])
    ])
  ],
  templateUrl: './browse.component.html',
  styleUrl: './browse.component.scss'
})
export class BrowseComponent implements OnInit, OnDestroy {
  movieRows = signal<any[]>([]);
  featuredMovie = signal<Video>({
    id: '',
    hlsManifestUrl: '',
    title: '',
    description: '',
    image: ''
  });
  private router = inject(Router);
  private movieService = inject(MovieService);
  private authService = inject(AuthService);

  ngOnInit() {
    this.loadMovies();
    this.currentFeaturedMovie();
  }

  loadMovies() {
    this.movieService.getMovies().subscribe({
      next: (value: Video[]) => {
        const processedMovies = value.map(movie => ({
          ...movie,
          image: './assets/spiderman.jfif' // Smooth immutable property overrides
        }));
        this.featuredMovie.set(processedMovies[0]);
        this.movieRows.set([
          {
            title: 'Trending Now',
            movies: [...processedMovies]
          },
          {
            title: 'Top 10 in Your Country',
            movies: [...processedMovies]
          },
          // ...
        ]);
        // this.movieRows.set(value);
      }
    })
    // Integrate API
    // this.movieService.getMovies().subscribe((movies: any) => {
    //   // Group into rows like Netflix (Trending, Top 10, etc.)
    //   this.movieRows.set([
    //     { title: 'Trending Now', movies: movies.slice(0, 10) },
    //     { title: 'Top 10 in Your Country', movies: movies.slice(5, 15) },
    //     // ...
    //   ]);
    //   this.featuredMovie = movies[0];
    // });
  }


  private movieSubscription?: Subscription;
  currentFeaturedMovie() {
    // const movieList: Video[] = [{
    //   id: '',
    //   hlsManifestUrl: '',
    //   image: './assets/spiderman.jfif',
    //   title: 'Spider- Man: Brand New Day',
    //   description: 'Peter Parker is back!'
    // },
    // {
    //   id: '',
    //   hlsManifestUrl: '',
    //   image: './assets/doomsday.jpg',
    //   title: 'Avengers: Doomsday',
    //   description: 'Return of RDJ'
    // }]

    // 1. Read the current value of your signal array
    const currentRows = this.movieRows();

    // 2. Find the object where the title matches 'Trending Now'
    const trendingRow = currentRows.find(row => row.title === 'Trending Now');

    // 3. Extract the movies array (with an empty array fallback if the row hasn't loaded yet)
    const trendingMovies = trendingRow ? trendingRow.movies : [];


    let i = 0;
    const totalMovies = trendingMovies.length;

    this.featuredMovie.set(trendingMovies[i]);
    if (this.movieSubscription) {
      this.movieSubscription.unsubscribe();
    }
    if (totalMovies > 1) {
      this.movieSubscription = interval(4000).subscribe(() => {
        i = (i + 1) % totalMovies;
        this.featuredMovie.set(trendingMovies[i]);
      });
    }
  }

  selectMovie(movie: any) {
    this.router.navigate(['/player', movie.id]);
  }

  playFeatured() {
    const id = this.featuredMovie().id;
    this.router.navigate(['/player', id]);
  }
  logOut() {
    this.authService.removeLocalStorage();
    this.router.navigate(['/login']);
  }
  ngOnDestroy() {
    if (this.movieSubscription) {
      this.movieSubscription.unsubscribe();
    }
  }
}

