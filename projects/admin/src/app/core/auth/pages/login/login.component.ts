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
 * Login en pasos (correo, contraseña), fuera del shell: sin sidebar ni topbar.
 *
 * @remarks
 * El paso del correo solo valida el formato: `POST /auth/login` valida correo
 * y contraseña juntos, así que un correo inexistente se descubre al enviar la
 * contraseña. Passkey, redes sociales y el paso de dos factores son solo
 * visuales.
 */
// TODO(backend): login con passkey y con redes sociales; los botones no tienen acción.
// TODO(backend): 2FA. Cuando exista, `submit()` debe pasar a `dosFactores` en vez de navegar.
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

  // `?paso=2fa` solo sirve para revisar la pantalla de dos factores; el flujo real no llega ahí.
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

  protected continuarConCorreo(): void {
    if (!EMAIL_RE.test(this.correo().trim())) {
      this.correoInvalido.set(true);
      return;
    }
    this.correoInvalido.set(false);
    this.paso.set('password');
  }

  // No se conserva una contraseña escrita para un correo que se va a cambiar.
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

  protected volverAPassword(): void {
    this.paso.set('password');
    this.codigoDosFactores.set('');
  }

  // El backend ya manda el mensaje en español listo para mostrar; aparte solo se cubre la falta de conexión.
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
