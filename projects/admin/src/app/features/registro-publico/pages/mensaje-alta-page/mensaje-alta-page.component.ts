import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  IconCircleCheckFilled,
  IconExclamationCircleFilled,
  IconMessageCircle,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { ContactoAlta, RegistroPublicoService } from '../../services/registro-publico.service';

/**
 * `/registro/mensaje` — destino del "escribinos" de los correos de alta
 * (registro recibido, llamada agendada, recordatorio de activación y
 * rechazo). Misma familia visual que `/reset-password`. Quien escribe
 * todavía no tiene cuenta: el token del correo identifica la Empresa.
 */
@Component({
  selector: 'app-mensaje-alta-page',
  standalone: true,
  imports: [TablerIconComponent, RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="flex min-h-screen flex-col items-center justify-center bg-login-bg p-6">
      <img src="/logo-goods-icon.png" alt="Goods" class="mb-8 h-32 w-auto" />
      <div class="w-full max-w-md rounded-2xl bg-card-bg p-8 shadow-xl">
        @if (cargando()) {
          <p class="py-10 text-center text-sm text-gray-500">Cargando…</p>
        } @else if (!datos()) {
          <div class="flex flex-col items-center py-6 text-center">
            <tabler-icon [icon]="iconError" [size]="56" svgClass="text-badge-error-solid" />
            <h1 class="mt-4 text-2xl font-bold text-gray-900">Enlace no válido</h1>
            <p class="mt-2 max-w-sm text-sm text-gray-600">{{ errorCarga() }}</p>
          </div>
        } @else if (enviado()) {
          <div class="animate-[fade-in-up_0.25s_ease-out] flex flex-col items-center py-6 text-center">
            <tabler-icon [icon]="iconExito" [size]="56" svgClass="text-emerald-500" />
            <h1 class="mt-4 text-2xl font-bold text-gray-900">Mensaje enviado</h1>
            <p class="mt-2 max-w-sm text-sm text-gray-600">
              Lo recibió el equipo que lleva el alta de {{ datos()!.empresa }}. Te respondemos por correo o por
              teléfono.
            </p>
            <button type="button" (click)="enviado.set(false)" class="mt-6 text-sm font-medium text-gray-700 hover:underline">
              Escribir otro mensaje
            </button>
          </div>
        } @else {
          <div class="animate-[fade-in-up_0.25s_ease-out]">
            <tabler-icon [icon]="iconMensaje" [size]="36" svgClass="text-gray-900" />
            <h1 class="mt-3 text-2xl font-bold text-gray-900">Escríbenos</h1>
            <p class="mt-1 text-sm text-gray-600">
              Sobre el alta de <strong>{{ datos()!.empresa }}</strong> · {{ datos()!.numeroSolicitud }}
            </p>

            @if (datos()!.puedeEscribir) {
              <label for="texto" class="mb-1 mt-5 block text-sm font-medium text-gray-700">Tu mensaje</label>
              <textarea
                id="texto"
                rows="5"
                maxlength="2000"
                [value]="texto()"
                (input)="texto.set($any($event.target).value); error.set(null)"
                placeholder="Por ejemplo: corregir un dato, cambiar el horario de la llamada o pedir un enlace nuevo."
                class="w-full resize-none rounded-lg bg-canvas-bg px-3 py-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-gray-400"
              ></textarea>
              <p class="mt-1 text-right text-xs text-gray-400">{{ texto().length }}/2000</p>
              @if (error(); as mensaje) {
                <p class="mt-2 flex items-center gap-1.5 rounded-lg bg-field-error-bg px-3 py-2.5 text-sm text-badge-error-solid">
                  <tabler-icon [icon]="iconError" [size]="16" svgClass="shrink-0" />
                  {{ mensaje }}
                </p>
              }
              <button
                type="button"
                (click)="enviar()"
                [disabled]="enviando() || !texto().trim()"
                class="mt-4 w-full rounded-lg bg-primary-button px-3 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:opacity-90 disabled:bg-gray-300 disabled:text-gray-500"
              >
                {{ enviando() ? 'Enviando…' : 'Enviar mensaje' }}
              </button>
            } @else {
              <p class="mt-5 rounded-lg bg-canvas-bg px-3 py-3 text-sm text-gray-700">
                Tu cuenta ya está activa. Escríbenos desde el chat de soporte de tu panel.
              </p>
              <a routerLink="/login" class="mt-4 block w-full rounded-lg bg-primary-button px-3 py-2.5 text-center text-sm font-medium text-white hover:opacity-90">Ir a iniciar sesión</a>
            }

            @if (datos()!.mensajes.length) {
              <h2 class="mt-6 text-xs font-semibold uppercase tracking-wide text-gray-500">Ya nos escribiste</h2>
              <ul class="mt-2 max-h-48 space-y-2 overflow-y-auto">
                @for (m of datos()!.mensajes; track $index) {
                  <li class="rounded-lg bg-canvas-bg px-3 py-2 text-sm text-gray-700">
                    <span class="block whitespace-pre-line">{{ m.texto }}</span>
                    <span class="mt-1 block text-xs text-gray-400">{{ m.creadoEn | date: "d MMM, HH:mm" }}</span>
                  </li>
                }
              </ul>
            }
          </div>
        }
      </div>
    </main>
  `,
})
export class MensajeAltaPageComponent implements OnInit {
  private readonly api = inject(RegistroPublicoService);
  private readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token');

  protected readonly iconError = IconExclamationCircleFilled;
  protected readonly iconExito = IconCircleCheckFilled;
  protected readonly iconMensaje = IconMessageCircle;

  protected readonly cargando = signal(true);
  protected readonly datos = signal<ContactoAlta | null>(null);
  protected readonly errorCarga = signal('Abre el enlace directamente desde el correo que te mandamos.');
  protected readonly texto = signal('');
  protected readonly enviando = signal(false);
  protected readonly enviado = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    if (!this.token) {
      this.cargando.set(false);
      return;
    }
    this.api.verContacto(this.token).subscribe({
      next: (d) => {
        this.datos.set(d);
        this.cargando.set(false);
      },
      error: (err: unknown) => {
        this.errorCarga.set(this.mensaje(err, 'El enlace no es válido o venció.'));
        this.cargando.set(false);
      },
    });
  }

  protected enviar(): void {
    const texto = this.texto().trim();
    if (!this.token || !texto || this.enviando()) return;
    this.enviando.set(true);
    this.api.enviarContacto(this.token, texto).subscribe({
      next: () => {
        this.enviando.set(false);
        this.enviado.set(true);
        this.texto.set('');
        this.datos.update((d) => d && { ...d, mensajes: [{ texto, creadoEn: new Date().toISOString() }, ...d.mensajes] });
      },
      error: (err: unknown) => {
        this.enviando.set(false);
        this.error.set(this.mensaje(err, 'No se pudo enviar. Intenta de nuevo.'));
      },
    });
  }

  private mensaje(err: unknown, porDefecto: string): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 0) return 'No se pudo conectar con el servidor. Revisa tu conexión.';
      const m = (err.error as { message?: string | string[] } | null)?.message;
      if (m) return Array.isArray(m) ? m.join(' ') : m;
    }
    return porDefecto;
  }
}
