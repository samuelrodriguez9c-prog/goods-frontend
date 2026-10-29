import { Routes } from '@angular/router';
import { MessageListPageComponent } from './pages/message-list-page/message-list-page.component';

export const MESSAGES_ROUTES: Routes = [{ path: '', component: MessageListPageComponent, data: { breadcrumb: 'Mensajes', icon: 'message-circle-2' } }];
