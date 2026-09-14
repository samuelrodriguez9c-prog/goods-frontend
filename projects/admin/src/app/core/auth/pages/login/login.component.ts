import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import {
  IconArrowRight,
  IconBrandApple,
  IconBrandFacebook,
  IconBrandGoogle,
  IconBrandWhatsapp,
  IconEye,
  IconEyeOff,
  IconExclamationCircleFilled,
  IconFingerprint,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { AuthService } from '../../auth.service';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LARGO_CODIGO_DOS_FACTORES = 6;

type PasoLogin = 'correo' | 'password' | 'dosFactores';

/**
 * Pantalla de login — vive fuera del árbol de rutas del shell (ver
 * `app.routes.ts`, comentario en `shell.component.ts`): sin sidebar ni
 * topbar, ocupa toda la pantalla.
 *
 * Diseño calcado del login de Shopify (capturas 1050-1059, aprobadas por
 * gerencia — ver ADMIN_DISENO.md > "Login"): fondo oscuro de página +
 * tarjeta blanca centrada, en pasos (correo, después contraseña con un
 * pill "Cambiar correo" para volver atrás) en vez de un solo formulario
 * con ambos campos a la vez.
 *
 * El paso 1 (`continuarConCorreo`) es solo de UI — no llama al backend,
 * solo valida el formato del correo y pasa al paso 2 — porque
 * `POST /auth/login` de nuestro backend valida correo+contraseña juntos
 * en una sola llamada (a diferencia de Shopify, que sí puede confirmar
 * la existencia del correo antes de pedir la contraseña). Por eso un
 * correo inexistente también se descubre recién al enviar el paso 2, y
 * el error se muestra ahí (mismo tratamiento visual que "contraseña
 * incorrecta" en las capturas 1055/1056: campo en rojo + ícono + texto).
 *
 * Passkey / Google / Apple / Facebook / WhatsApp (capturas 1050 y 1059) y
 * el paso de dos factores (capturas 1057-1058) están integrados a nivel
 * visual — mismo criterio que otros placeholders del admin (topbar,
 * notificaciones) — pero SIN lógica real todavía:
 * - El botón de passkey y los de redes sociales no tienen (click): no hay
 *   nada que llamar (WebAuthn, OAuth de cada proveedor) hasta que se
 *   decida cuál se implementa primero.
 * - El paso `dosFactores` es una pantalla real (no un mock aparte fuera
 *   del componente) pero hoy es INALCANZABLE desde el flujo real, porque
 *   el backend no tiene 2FA — `submit()` nunca la dispara. Se puede ver
 *   entrando a `/login?paso=2fa` (leído en el constructor, ver abajo)
 *   solo para revisarla; ningún usuario real llega ahí por accidente. El
 *   día que el backend exponga 2FA, `submit()` debería redirigir a este
 *   paso cuando el login devuelva ese estado, en vez de navegar directo.
 * - La pantalla de "acceso más rápido con passkey" que Shopify muestra
 *   DESPUÉS de cada login exitoso (captura 1059) no se construyó: meterla
 *   en el flujo real le agregaría un paso extra a cada inicio de sesión
 *   de un usuario real, que es más que "integrar visualmente" — se dejó
 *   fuera a propósito (ver ADMIN_DISENO.md > "Login").
 *
 * Sin Angular Forms (`FormsModule`/`ReactiveFormsModule`): en todo el
 * resto del código los formularios simples usan `<input>` nativo +
 * signals a mano (ver `QuickAdjustPopoverComponent`) — se mantiene el
 * mismo criterio acá en vez de introducir Forms solo para dos campos.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly iconEye = IconEye;
  protected readonly iconEyeOff = IconEyeOff;
  protected readonly iconError = IconExclamationCircleFilled;
  protected readonly iconArrowRight = IconArrowRight;
  protected readonly iconFingerprint = IconFingerprint;
  protected readonly iconGoogle = IconBrandGoogle;
  protected readonly iconApple = IconBrandApple;
  protected readonly iconFacebook = IconBrandFacebook;
  protected readonly iconWhatsapp = IconBrandWhatsapp;

  // `?paso=2fa` es solo para poder revisar la pantalla de dos factores
  // (ver comentario de la clase) — no es una entrada real del flujo.
  protected readonly paso = signal<PasoLogin>(
    this.route.snapshot.queryParamMap.get('paso') === '2fa' ? 'dosFactores' : 'correo',
  );
  protected readonly correo = signal('');
  protected readonly password = signal('');
  protected readonly mostrarPassword = signal(false);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly correoInvalido = signal(false);
  protected readonly codigoDosFactores = signal('');

  protected onCorreoChange(value: string): void {
    this.correo.set(value);
    this.correoInvalido.set(false);
  }

  protected onPasswordChange(value: string): void {
    this.password.set(value);
    this.error.set(null);
  }

  protected togglePassword(): void {
    this.mostrarPassword.update((valor) => !valor);
  }

  /** Paso 1 → 2. Solo valida formato — ver comentario de la clase sobre
   * por qué no hay una llamada real al backend acá todavía. */
  protected continuarConCorreo(): void {
    if (!EMAIL_RE.test(this.correo().trim())) {
      this.correoInvalido.set(true);
      return;
    }
    this.correoInvalido.set(false);
    this.paso.set('password');
  }

  /** Pill "Cambiar correo" (capturas 1052-1056): vuelve al paso 1 y
   * limpia la contraseña/error — no tiene sentido conservar una
   * contraseña tipeada para un correo que se está por cambiar. */
  protected cambiarCorreo(): void {
    this.paso.set('correo');
    this.password.set('');
    this.error.set(null);
    this.mostrarPassword.set(false);
  }

  protected submit(): void {
    if (this.cargando()) {
      return;
    }
    this.error.set(null);
    this.cargando.set(true);

    this.authService.login(this.correo().trim(), this.password()).subscribe({
      next: () => {
        this.cargando.set(false);
        this.router.navigateByUrl('/');
      },
      error: (err: unknown) => {
        this.cargando.set(false);
        this.error.set(this.mensajeDeError(err));
      },
    });
  }

  protected onCodigoDosFactoresChange(value: string): void {
    this.codigoDosFactores.set(value.replace(/\D/g, '').slice(0, LARGO_CODIGO_DOS_FACTORES));
  }

  /** Vuelve al paso de contraseña — el "usar otro método" de la captura
   * 1058. Sin backend de 2FA no hay otro método real que ofrecer todavía. */
  protected volverAPassword(): void {
    this.paso.set('password');
    this.codigoDosFactores.set('');
  }

  // El backend devuelve mensajes en español ya listos para mostrar (ver
  // AuthController/AuthService — NotFoundException/UnauthorizedException
  // con texto orientado al usuario), así que basta con leer
  // `error.error.message`; solo se cubre el caso sin conexión aparte.
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
    return 'No se pudo iniciar sesión. Intenta de nuevo.';
  }
}
