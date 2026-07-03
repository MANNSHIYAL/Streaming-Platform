import { Component, ComponentRef, ElementRef, inject, viewChild, ViewChild, ViewContainerRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth.service';
import { LoginUser, RegisterUser } from '../../../models/auth.model';
import { LoginComponent } from '../login/login.component';

@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  private authService = inject(AuthService);
  private vcr = inject(ViewContainerRef);

  private loginRef: ComponentRef<LoginComponent> | null = null;
  userRegister: RegisterUser = {
    username: '',
    email: '',
    password: '',
    role: ''
  };
  onRegister() {
    if (this.userRegister.username.length <= 2 || this.userRegister.password.length <= 2 || this.userRegister.email.length <= 6) return;
    this.userRegister.role = 'ADMIN';
    this.authService.registerUser(this.userRegister).subscribe({
      next: (value: any) => { },
      complete: () => {
        const userLogin: LoginUser = {
          user: this.userRegister.email,
          password: this.userRegister.password
        }
        this.vcr.clear();
        this.loginRef = this.vcr.createComponent(LoginComponent);
        if (this.loginRef) {
          this.loginRef.instance.onLogin(userLogin);
        }
      },
      error: (e: any) => {
        console.error(e);
      }
    })
  }
}
