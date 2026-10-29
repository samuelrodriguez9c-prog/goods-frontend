import { Routes } from '@angular/router';
import { DiscountListPageComponent } from './pages/discount-list-page/discount-list-page.component';

export const DISCOUNTS_ROUTES: Routes = [{ path: '', component: DiscountListPageComponent, data: { breadcrumb: 'Descuentos', icon: 'discount-2' } }];
