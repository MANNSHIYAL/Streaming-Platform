import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/auth.service';
import { LoginUser } from '../../../models/auth.model';
import { routes } from '../../../app.routes';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink, RouterModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  userLogin: LoginUser = {
    user: '',
    password: ''
  }
  onLogin(user?: LoginUser) {
    if (user) this.userLogin = user;
    if (this.userLogin.user.length <= 2 || this.userLogin.password.length <= 2) return;
    this.authService.loginUser(this.userLogin).subscribe({
      next: (value: any) => {
        this.authService.setLocalStorage(this.userLogin, value);
        this.router.navigate(['browse']);
      },
      error: (e: any) => {
        console.error(e);
      }
    })
  }

}
