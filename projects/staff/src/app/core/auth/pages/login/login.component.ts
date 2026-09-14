import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { IconEye, IconEyeOff, IconExclamationCircleFilled, TablerIconComponent } from '@tabler/icons-angular';
import { AuthService } from '../../auth.service';

/**
 * Login del panel de staff — a diferencia de `admin/core/auth/pages/login/`
 * (calcado del login de Shopify en varios pasos, con passkeys/redes
 * sociales/2FA integrados a nivel visual), acá es un login interno simple
 * de un solo paso: correo + contraseña, mismo lenguaje visual (fondo
 * oscuro, tarjeta blanca centrada, tokens de `styles.css`) pero sin nada
 * de eso — este panel lo usa personal de Goods, no clientes finales, no
 * hay una referencia de Shopify que calcar acá ni tiene sentido ofrecer
 * "iniciar sesión con Google" para un puñado de cuentas internas.
 *
 * Chequeo de rol: `POST /auth/login` es el mismo endpoint que usa
 * `admin` — no valida acá si quien se loguea es personal de Goods. Por
 * eso, tras un login exitoso, se mira `currentUser().rol.nombre`: si no
 * es `staff_goods`, se trata como si el login hubiera fallado (se limpia
 * la sesión y se muestra un error) en vez de dejar pasar al shell. Ver
 * `auth.guard.ts` sobre por qué este chequeo vive acá y no en el guard.
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

  protected readonly iconEye = IconEye;
  protected readonly iconEyeOff = IconEyeOff;
  protected readonly iconError = IconExclamationCircleFilled;

  protected readonly correo = signal('');
  protected readonly password = signal('');
  protected readonly mostrarPassword = signal(false);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected onCorreoChange(value: string): void {
    this.correo.set(value);
    this.error.set(null);
  }

  protected onPasswordChange(value: string): void {
    this.password.set(value);
    this.error.set(null);
  }

  protected togglePassword(): void {
    this.mostrarPassword.update((valor) => !valor);
  }

  protected submit(): void {
    if (this.cargando()) {
      return;
    }
    this.error.set(null);
    this.cargando.set(true);

    this.authService.login(this.correo().trim(), this.password()).subscribe({
      next: (usuario) => {
        this.cargando.set(false);
        if (usuario.rol.nombre !== 'staff_goods') {
          this.authService.limpiarSesion();
          this.error.set('Esta cuenta no tiene acceso al panel de staff.');
          return;
        }
        this.router.navigateByUrl('/');
      },
      error: (err: unknown) => {
        this.cargando.set(false);
        this.error.set(this.mensajeDeError(err));
      },
    });
  }

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
