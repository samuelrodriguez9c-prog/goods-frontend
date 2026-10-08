import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  IconCircleCheckFilled,
  IconExclamationCircleFilled,
  IconShieldLock,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { AuthService } from '../../auth.service';

/**
 * `/cuenta/no-fui-yo` — destino del botón "No fui yo" del correo
 * `password-changed`. Misma familia visual que `/reset-password` (fondo
 * oscuro + tarjeta). Explica qué va a pasar y espera un clic: recién ahí
 * llama `POST /auth/reportar-cambio-password`, que cierra las sesiones,
 * deja la cuenta sin contraseña, manda un enlace para definir una nueva y
 * abre una conversación con soporte.
 */
@Component({
  selector: 'app-no-fui-yo',
  standalone: true,
  imports: [TablerIconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="flex min-h-screen flex-col items-center justify-center bg-login-bg p-6">
      <img src="/logo-goods-icon.png" alt="Goods" class="mb-8 h-32 w-auto" />
      <div class="w-full max-w-md rounded-2xl bg-card-bg p-8 shadow-xl">
        @if (!token) {
          <div class="flex flex-col items-center py-6 text-center">
            <tabler-icon [icon]="iconError" [size]="56" svgClass="text-badge-error-solid" />
            <h1 class="mt-4 text-2xl font-bold text-gray-900">Enlace no válido</h1>
            <p class="mt-2 max-w-sm text-sm text-gray-600">
              Abre el botón «No fui yo» directamente desde el correo que te mandamos.
            </p>
            <a routerLink="/login" class="mt-6 rounded-lg bg-primary-button px-4 py-2.5 text-sm font-medium text-white hover:opacity-90">Ir a iniciar sesión</a>
          </div>
        } @else if (listo()) {
          <div class="animate-[fade-in-up_0.25s_ease-out] flex flex-col items-center py-6 text-center">
            <tabler-icon [icon]="iconExito" [size]="56" svgClass="text-emerald-500" />
            <h1 class="mt-4 text-2xl font-bold text-gray-900">Tu cuenta está protegida</h1>
            <p class="mt-2 max-w-sm text-sm text-gray-600">
              Cerramos todas las sesiones abiertas y te mandamos un correo para crear una contraseña nueva
              (el enlace vale 1 hora). Nuestro equipo de soporte ya está al tanto y te va a escribir.
            </p>
            <a routerLink="/login" class="mt-6 rounded-lg bg-primary-button px-4 py-2.5 text-sm font-medium text-white hover:opacity-90">Ir a iniciar sesión</a>
          </div>
        } @else {
          <div class="animate-[fade-in-up_0.25s_ease-out]">
            <tabler-icon [icon]="iconEscudo" [size]="40" svgClass="text-gray-900" />
            <h1 class="mt-3 text-2xl font-bold text-gray-900">¿No cambiaste tu contraseña?</h1>
            <p class="mt-2 text-sm text-gray-600">Si confirmas, vamos a:</p>
            <ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-600">
              <li>cerrar todas las sesiones abiertas de tu cuenta;</li>
              <li>desactivar la contraseña actual;</li>
              <li>mandarte un correo para crear una nueva;</li>
              <li>avisar a nuestro equipo de soporte.</li>
            </ul>
            @if (error(); as mensaje) {
              <p class="mt-4 flex items-center gap-1.5 rounded-lg bg-field-error-bg px-3 py-2.5 text-sm text-badge-error-solid">
                <tabler-icon [icon]="iconError" [size]="16" svgClass="shrink-0" />
                {{ mensaje }}
              </p>
            }
            <button
              type="button"
              (click)="confirmar()"
              [disabled]="enviando()"
              class="mt-6 w-full rounded-lg bg-primary-button px-3 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:opacity-90 disabled:bg-gray-300 disabled:text-gray-500"
            >
              {{ enviando() ? 'Protegiendo tu cuenta…' : 'Sí, no fui yo: proteger mi cuenta' }}
            </button>
            <a routerLink="/login" class="mt-3 block text-center text-sm text-gray-500 hover:underline">Fui yo, todo bien</a>
          </div>
        }
      </div>
    </main>
  `,
})
export class NoFuiYoComponent {
  private readonly auth = inject(AuthService);
  protected readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token');

  protected readonly iconError = IconExclamationCircleFilled;
  protected readonly iconExito = IconCircleCheckFilled;
  protected readonly iconEscudo = IconShieldLock;

  protected readonly enviando = signal(false);
  protected readonly listo = signal(false);
  protected readonly error = signal<string | null>(null);

  protected confirmar(): void {
    if (!this.token || this.enviando()) return;
    this.enviando.set(true);
    this.error.set(null);
    this.auth.reportarCambioPassword(this.token).subscribe({
      next: () => {
        this.enviando.set(false);
        this.listo.set(true);
      },
      error: (err: unknown) => {
        this.enviando.set(false);
        const m = err instanceof HttpErrorResponse ? (err.error as { message?: string } | null)?.message : null;
        this.error.set(
          err instanceof HttpErrorResponse && err.status === 0
            ? 'No se pudo conectar con el servidor. Revisa tu conexión.'
            : (m ?? 'No pudimos procesarlo. Intenta de nuevo o escríbenos.'),
        );
      },
    });
  }
}
