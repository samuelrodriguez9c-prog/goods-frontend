import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import {
  IconCircleCheckFilled,
  IconEye,
  IconEyeOff,
  IconExclamationCircleFilled,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { AuthService } from '../../auth.service';

type FuerzaPassword = 'ninguna' | 'debil' | 'media' | 'fuerte';
type PasoResetPassword = 'formulario' | 'exito';

interface CamposInvalidos {
  password?: boolean;
  confirmar?: boolean;
}

/**
 * Pantalla `/reset-password` (§8 punto 6 de
 * PROPUESTA_FLUJO_ALTA_ASISTIDA.md — hasta ahora esta ruta no existía en
 * el admin). Es la pantalla a la que apunta el enlace del correo de
 * "restablecer contraseña" / confirmación de alta asistida: lee `token`
 * de la query string y llama `POST /auth/reset-password`
 * (`AuthController.resetPassword`), endpoint que ya existía en el
 * backend desde antes de esta pantalla (ver `AuthService.resetPassword`
 * del backend: valida el JWT del token, actualiza la contraseña, revoca
 * todas las sesiones activas y, si el usuario pertenece a una Empresa en
 * alta asistida, la activa — todo en la misma llamada).
 *
 * Diseño calcado del flujo de reseteo de contraseña de Shopify (capturas
 * "Shopify Web Resetting password 0-5", aprobadas por el cliente
 * 2026-09-15) en su estructura (tarjeta con "New password"/"Confirm new
 * password", medidor de fuerza, ayuda de "al menos 8 caracteres..."),
 * pero con los tokens/convenciones ya establecidos de Goods (mismo
 * fondo/tarjeta que `LoginComponent`), no un skin literal de Shopify. La
 * caja informativa de la captura 3 sobre "esta contraseña es compartida
 * entre 2 stores..." no aplica acá: en Goods una cuenta de dueño
 * pertenece a una sola Empresa, así que se omite.
 *
 * Sin Angular Forms, mismo patrón que `LoginComponent`/
 * `RegistroPublicoPageComponent`: `<input>` nativo + signals a mano.
 *
 * Sin token en la URL (alguien entra a `/reset-password` directo, sin
 * pasar por un enlace de correo) no tiene sentido mostrar el formulario
 * — se corta antes con una pantalla de "enlace no válido". Un token
 * presente pero inválido/expirado recién se descubre al enviar el
 * formulario: el backend no tiene un endpoint aparte para "validar" el
 * token sin consumirlo (ver comentario de `AuthService.resetPassword`
 * del backend), así que ese caso se muestra como el resto de errores del
 * formulario (banner rojo con el mensaje que devuelve el backend:
 * "Token inválido o expirado").
 */
@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reset-password.component.html',
})
export class ResetPasswordComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly iconEye = IconEye;
  protected readonly iconEyeOff = IconEyeOff;
  protected readonly iconError = IconExclamationCircleFilled;
  protected readonly iconExito = IconCircleCheckFilled;

  protected readonly token = signal<string | null>(null);
  protected readonly paso = signal<PasoResetPassword>('formulario');

  protected readonly password = signal('');
  protected readonly confirmarPassword = signal('');
  protected readonly mostrarPassword = signal(false);
  protected readonly mostrarConfirmarPassword = signal(false);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly camposInvalidos = signal<CamposInvalidos>({});

  // Mismos requisitos que la ayuda de la captura 3 de Shopify ("at least
  // 8 characters, and can't begin or end with a space"): el backend solo
  // exige @MinLength(8) (ver ResetPasswordDto) — el resto es validación
  // de UX del lado del cliente, calcada de la referencia.
  protected readonly fuerza = computed<FuerzaPassword>(() => {
    const valor = this.password();
    if (valor.length === 0) {
      return 'ninguna';
    }
    let puntos = 0;
    if (valor.length >= 8) puntos++;
    if (valor.length >= 12) puntos++;
    if (/[a-z]/.test(valor) && /[A-Z]/.test(valor)) puntos++;
    if (/\d/.test(valor)) puntos++;
    if (/[^A-Za-z0-9]/.test(valor)) puntos++;
    if (puntos <= 1) return 'debil';
    if (puntos <= 3) return 'media';
    return 'fuerte';
  });

  ngOnInit(): void {
    this.token.set(this.route.snapshot.queryParamMap.get('token'));
  }

  protected togglePassword(): void {
    this.mostrarPassword.update((valor) => !valor);
  }

  protected toggleConfirmarPassword(): void {
    this.mostrarConfirmarPassword.update((valor) => !valor);
  }

  protected onPasswordChange(value: string): void {
    this.password.set(value);
    this.camposInvalidos.update((actual) => ({ ...actual, password: false }));
    this.error.set(null);
  }

  protected onConfirmarPasswordChange(value: string): void {
    this.confirmarPassword.set(value);
    this.camposInvalidos.update((actual) => ({ ...actual, confirmar: false }));
    this.error.set(null);
  }

  protected submit(): void {
    const token = this.token();
    if (!token || this.enviando()) {
      return;
    }

    const password = this.password();
    const confirmar = this.confirmarPassword();
    const invalidos: CamposInvalidos = {
      password: password.length < 8 || password !== password.trim(),
      confirmar: password !== confirmar,
    };
    this.camposInvalidos.set(invalidos);
    if (invalidos.password || invalidos.confirmar) {
      return;
    }

    this.enviando.set(true);
    this.error.set(null);

    this.authService.resetPassword(token, password).subscribe({
      next: () => {
        this.enviando.set(false);
        this.paso.set('exito');
      },
      error: (err: unknown) => {
        this.enviando.set(false);
        this.error.set(this.mensajeDeError(err));
      },
    });
  }

  protected irALogin(): void {
    this.router.navigateByUrl('/login');
  }

  // Mismo criterio que LoginComponent/RegistroPublicoPageComponent: el
  // backend devuelve mensajes en español ya listos para mostrar (acá en
  // particular "Token inválido o expirado" — ver AuthService.resetPassword
  // del backend).
  private mensajeDeError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 0) {
        return 'No se pudo conectar con el servidor. Revisa tu conexión.';
      }
      const mensaje = (err.error as { message?: string } | null)?.message;
      if (mensaje) {
        return Array.isArray(mensaje) ? mensaje.join(' ') : mensaje;
      }
    }
    return 'No se pudo restablecer la contraseña. Intenta de nuevo.';
  }
}
