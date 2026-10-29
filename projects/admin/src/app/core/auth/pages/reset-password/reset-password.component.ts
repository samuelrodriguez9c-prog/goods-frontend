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
import { AuthService, InfoEnlace } from '../../auth.service';

type FuerzaPassword = 'ninguna' | 'debil' | 'media' | 'fuerte';
type PasoResetPassword = 'formulario' | 'exito';

interface CamposInvalidos {
  nombres?: boolean;
  password?: boolean;
  confirmar?: boolean;
}

/**
 * `/reset-password`: destino del enlace para definir o restablecer la
 * contraseña (también confirma el alta asistida). Lee `token` de la URL y
 * llama `POST /auth/reset-password`.
 *
 * @remarks
 * - Sin token en la URL, o si `GET /auth/enlace` dice que venció o ya se
 *   usó, se muestra «enlace no válido».
 * - `primeraVez` (invitación o activación) cambia el título a «Crea tu
 *   contraseña»; `necesitaNombre` (invitación solo con el correo) pide nombre
 *   y apellido, que van en el mismo `POST /auth/reset-password`.
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
  /** `null` mientras carga; si el enlace no sirve, queda en `enlaceMalo`. */
  protected readonly info = signal<InfoEnlace | null>(null);
  protected readonly enlaceMalo = signal<string | null>(null);
  protected readonly nombres = signal('');
  protected readonly apellidos = signal('');

  protected readonly password = signal('');
  protected readonly confirmarPassword = signal('');
  protected readonly mostrarPassword = signal(false);
  protected readonly mostrarConfirmarPassword = signal(false);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly camposInvalidos = signal<CamposInvalidos>({});

  // Solo orientativo: no bloquea el envío.
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
    const token = this.route.snapshot.queryParamMap.get('token');
    this.token.set(token);
    if (!token) return;
    this.authService.infoEnlace(token).subscribe({
      next: (i) => this.info.set(i),
      // Sin conexión no se sabe si el enlace sirve: se deja enviar igual.
      error: (err: unknown) =>
        err instanceof HttpErrorResponse && err.status === 0
          ? this.info.set({ correo: '', nombres: '', apellidos: '', primeraVez: false, necesitaNombre: false })
          : this.enlaceMalo.set(this.mensajeDeError(err).replace(/\.$/, '')),
    });
  }

  protected onNombresChange(value: string): void {
    this.nombres.set(value);
    this.camposInvalidos.update((actual) => ({ ...actual, nombres: false }));
    this.error.set(null);
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
    // El backend solo exige 8 caracteres; lo de los espacios en los bordes es validación del cliente.
    const pideNombre = !!this.info()?.necesitaNombre;
    const invalidos: CamposInvalidos = {
      nombres: pideNombre && !this.nombres().trim(),
      password: password.length < 8 || password !== password.trim(),
      confirmar: password !== confirmar,
    };
    this.camposInvalidos.set(invalidos);
    if (invalidos.nombres || invalidos.password || invalidos.confirmar) {
      return;
    }

    this.enviando.set(true);
    this.error.set(null);

    const nombre = pideNombre
      ? { nombres: this.nombres().trim(), apellidos: this.apellidos().trim() }
      : undefined;
    this.authService.resetPassword(token, password, nombre).subscribe({
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

  // El backend ya manda el mensaje en español (por ejemplo, «Token inválido o expirado»).
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
