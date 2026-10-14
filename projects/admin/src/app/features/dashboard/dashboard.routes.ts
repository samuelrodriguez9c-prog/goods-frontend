import { Routes } from '@angular/router';
import { DashboardPageComponent } from './pages/dashboard-page/dashboard-page.component';

export const DASHBOARD_ROUTES: Routes = [{ path: '', component: DashboardPageComponent, data: { breadcrumb: 'Dashboard', icon: 'home-2' } }];
