import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { LoginUser, RegisterUser } from '../models/auth.model';
import { environment } from '../../environments/environment.development';
import { RegisterComponent } from '../features/auth/register/register.component';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private baseURL = environment.apiUrl + 'auth/';

  constructor(private http: HttpClient) { }

  loginUser(user: LoginUser) {
    return this.http.post(this.baseURL + 'login', user);
  }

  registerUser(user: RegisterUser) {
    return this.http.post(this.baseURL + 'register', user);
  }

  setLocalStorage(userLogin: LoginUser, value: any) {
    localStorage.setItem("token", value.token);
  }

  removeLocalStorage() {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  }

  // Signal tracking the login status (now checks for presence AND validity)
  private loggedInSignal = signal<boolean>(this.hasValidToken());
  // Signal tracking the user's role
  private userRoleSignal = signal<string>(this.getRoleFromToken());

  // Expose read-only states
  readonly isAuthenticated = this.loggedInSignal.asReadonly();
  readonly getUserRole = this.userRoleSignal.asReadonly();

  /**
   * Decodes the token payload safely
   */
  private decodeToken(): any | null {
    const token = localStorage.getItem('token');
    if (!token) return null;
    try {
      return JSON.parse(atob(token.split('.')[1]));
    } catch {
      return null;
    }
  }

  /**
   * Checks if a token exists and is NOT expired
   */
  private hasValidToken(): boolean {
    const payload = this.decodeToken();
    if (!payload) return false;

    // If there is no exp claim, assume it is valid just by existing
    if (!payload.exp) return true;

    const currentTimeInSeconds = Math.floor(Date.now() / 1000);
    const isTokenExpired = currentTimeInSeconds >= payload.exp;

    if (isTokenExpired) {
      console.warn('Token found but it is expired.');
      localStorage.removeItem('token'); // Clean up expired token
      return false;
    }

    return true;
  }

  private getRoleFromToken(): string {
    const payload = this.decodeToken();
    if (!payload) return '';

    // Fallback check: if token is expired, don't return a role
    const currentTimeInSeconds = Math.floor(Date.now() / 1000);
    if (payload.exp && currentTimeInSeconds >= payload.exp) {
      return '';
    }

    return payload.role || '';
  }

  /**
   * Public method to manually trigger a re-validation (useful for guards)
   */
  public checkTokenValidity(): boolean {
    const isValid = this.hasValidToken();
    this.loggedInSignal.set(isValid);
    if (!isValid) {
      this.userRoleSignal.set('');
    }
    return isValid;
  }

  login(token: string) {
    localStorage.setItem('token', token);
    this.loggedInSignal.set(true);
    this.userRoleSignal.set(this.getRoleFromToken());
  }

  logout() {
    localStorage.removeItem('token');
    this.loggedInSignal.set(false);
    this.userRoleSignal.set('');
  }
}
