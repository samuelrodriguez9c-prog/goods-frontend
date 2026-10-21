import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { IconEye, IconEyeOff, IconExclamationCircleFilled, TablerIconComponent } from '@tabler/icons-angular';
import { AuthService } from '../../auth.service';

/**
 * Login interno de un solo paso (correo y contraseña): lo usa solo el
 * personal de Goods, así que no lleva redes sociales ni passkeys.
 *
 * El chequeo de `rol.esRolStaff` en `submit()` es defensa en profundidad:
 * `POST /auth/login-staff` ya responde 403 a las cuentas sin acceso.
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
        if (!usuario.rol.esRolStaff) {
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
