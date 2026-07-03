import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';
import { BrowseComponent } from './features/browse/browse.component';
import { PlayerComponent } from './features/player/player.component';
import { UploadComponent } from './features/upload/upload.component';
import { AdminComponent } from './features/admin/admin.component';
import { authGuard } from './shared/auth.guard';

export const routes: Routes = [
    { path: '', redirectTo: '/login', pathMatch: 'full' },
    { path: 'login', component: LoginComponent },
    { path: 'register', component: RegisterComponent },
    // { path: 'browse', component: BrowseComponent },
    // { path: 'player/:id', component: PlayerComponent },
    { path: 'video-upload', component: UploadComponent, canActivate: [authGuard], data: { expectedRoles: ['ADMIN', 'UPLOADER'] } },
    { path: 'admin', component: AdminComponent, canActivate: [authGuard], data: { expectedRoles: ['ADMIN'] } },
    { path: 'browse', component: BrowseComponent, canActivate: [authGuard], data: { expectedRoles: ['ADMIN', 'UPLOADER'] } },
    { path: 'player/:id', component: PlayerComponent, canActivate: [authGuard], data: { expectedRoles: ['ADMIN', 'UPLOADER', 'USER'] } },
    // { path: '', redirectTo: 'browse', pathMatch: 'full' },

    // 5. Catch-All Wildcard (Prevents 404 router crashes by bouncing broken paths back to login)
    // { path: '**', redirectTo: 'login' }
    // { path: 'upload', component: UploadComponent, canActivate: [roleGuard('uploader')] },
    // { path: 'admin', component: AdminComponent, canActivate: [roleGuard('admin')] },
];

