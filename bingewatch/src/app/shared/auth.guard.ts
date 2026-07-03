import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../core/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // 1. Check if the user is authenticated
  if (!authService.isAuthenticated()) {
    // Redirect to login page and preserve the attempted URL
    router.navigate(['/login']);
    return false;
  }

  if (state.url.includes('/browse')) {
    return true;
  }

  // 2. Optional: Check for Role Authorization
  // Reads the 'expectedRoles' array defined in the route routing configuration
  const expectedRoles = route.data['expectedRoles'] as string[];

  if (expectedRoles && expectedRoles.length > 0) {

    const isTokenValid = authService.checkTokenValidity();

    const isAuthenticated = authService.isAuthenticated;

    if (!isTokenValid || !isAuthenticated) {
      router.navigate(['login']);
      return false;
    }
    const userRole = authService.getUserRole(); // e.g., returns 'ADMIN' or 'USER'
    console.log(expectedRoles);

    console.log(userRole);

    // Check if the user's role matches any of the allowed roles
    const hasRole = expectedRoles.includes(userRole);

    if (!hasRole) {
      router.navigate(['browse']); // Redirect to an error page
      return false;
    }
  }

  return true; // Grant access
};
