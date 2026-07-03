export const environment = {
    production: false,
    apiUrl: 'http://api.livestreaming.local/',  // Replace with your actual APIs
    // apiUrl: 'http://localhost:3002/',  // Replace with your actual APIs
    // Auth
    login: '/auth/login',
    register: '/auth/register',
    verify: '/auth/videos/verify',
    // Movies
    movies: '/movies',
    upload: '/upload/getPreSignedUrl',
    // Admin
    adminUsers: '/admin/users',
    adminMovies: '/admin/movies'
};
