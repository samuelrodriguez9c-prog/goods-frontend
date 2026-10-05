import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IconBulb, IconPlus, IconSend, IconX, TablerIconComponent } from '@tabler/icons-angular';
import { StatusBadgeComponent } from 'shared-ui';
import { AuthService } from '../../../../core/auth/auth.service';
import { RealtimeService } from '../../../../core/realtime/realtime.service';
import {
  ESTADO_SOLICITUD,
  NOMBRE_MODULO,
  Solicitud,
  TIPOS_SOLICITUD,
  TipoSolicitud,
} from '../../../../core/solicitudes/models/solicitud.model';
import { mensajeDeError, SolicitudesService } from '../../../../core/solicitudes/solicitudes.service';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
const fecha = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
};

/**
 * "Solicitudes a Goods" (2026-10-04): donde la Empresa pide una mejora
 * (ajuste de un módulo, datos propios, una sección nueva u otra cosa) y
 * sigue en qué va. Ver PROPUESTA_PERSONALIZACION_POR_EMPRESA.md. Se
 * actualiza en vivo cuando Goods responde (`solicitud:cambio`).
 */
@Component({
  selector: 'app-settings-solicitudes-page',
  standalone: true,
  imports: [FormsModule, TablerIconComponent, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-solicitudes-page.component.html',
})
export class SettingsSolicitudesPageComponent {
  private readonly solicitudes = inject(SolicitudesService);
  private readonly auth = inject(AuthService);
  private readonly realtime = inject(RealtimeService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly i = { nueva: IconPlus, enviar: IconSend, cerrar: IconX, idea: IconBulb };
  protected readonly tipos = TIPOS_SOLICITUD;
  protected readonly estadoInfo = ESTADO_SOLICITUD;
  protected readonly fecha = fecha;

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly lista = signal<Solicitud[]>([]);
  protected readonly abierta = signal<Solicitud | null>(null);
  protected readonly creando = signal(false);

  // Formulario
  protected readonly tipo = signal<TipoSolicitud>('ajuste_modulo');
  protected readonly moduloCodigo = signal('');
  protected readonly titulo = signal('');
  protected readonly descripcion = signal('');
  protected readonly enviando = signal(false);
  protected readonly errorForm = signal<string | null>(null);

  // Detalle
  protected readonly comentario = signal('');
  protected readonly comentando = signal(false);
  protected readonly confirmandoRetiro = signal(false);
  protected readonly errorDetalle = signal<string | null>(null);

  protected readonly misModulos = computed(() =>
    (this.auth.currentUser()?.modulosDisponibles ?? []).map((codigo) => ({ codigo, nombre: NOMBRE_MODULO[codigo] ?? codigo })),
  );
  protected readonly tipoElegido = computed(() => TIPOS_SOLICITUD.find((t) => t.valor === this.tipo())!);
  protected readonly formValido = computed(
    () => this.titulo().trim().length >= 5 && this.descripcion().trim().length >= 15 && !this.enviando(),
  );
  protected readonly abiertas = computed(() => this.lista().filter((s) => ['recibida', 'en_evaluacion', 'aprobada', 'en_desarrollo'].includes(s.estado)));
  protected readonly cerradas = computed(() => this.lista().filter((s) => !['recibida', 'en_evaluacion', 'aprobada', 'en_desarrollo'].includes(s.estado)));

  protected readonly eventos = computed(() =>
    (this.abierta()?.eventos ?? []).map((e) => ({
      ...e,
      titulo:
        e.tipo === 'estado'
          ? e.estadoAnterior
            ? ESTADO_SOLICITUD[e.estadoNuevo!].texto
            : 'Enviaste la solicitud'
          : e.deGoods
            ? 'Equipo de Goods'
            : (e.autor?.nombre ?? 'Tu equipo'),
    })),
  );

  constructor() {
    this.cargar();
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((q) => {
      const id = Number(q.get('id'));
      if (id) this.abrir(id);
    });
    this.realtime
      .escuchar<{ solicitudId: number }>('solicitud:cambio')
      .pipe(takeUntilDestroyed())
      .subscribe(({ solicitudId }) => {
        this.cargar();
        if (this.abierta()?.id === solicitudId) this.abrir(solicitudId);
      });
  }

  protected cargar(): void {
    this.solicitudes.listar().subscribe({
      next: (r) => {
        this.lista.set(r.data);
        this.cargando.set(false);
      },
      error: (err) => {
        this.error.set(mensajeDeError(err, 'No se pudieron cargar tus solicitudes.'));
        this.cargando.set(false);
      },
    });
  }

  protected nueva(): void {
    this.abierta.set(null);
    this.creando.set(true);
    this.errorForm.set(null);
  }

  protected abrir(id: number): void {
    this.creando.set(false);
    this.errorDetalle.set(null);
    this.confirmandoRetiro.set(false);
    this.solicitudes.obtener(id).subscribe({
      next: (s) => this.abierta.set(s),
      error: (err) => this.errorDetalle.set(mensajeDeError(err)),
    });
  }

  protected cerrar(): void {
    this.abierta.set(null);
    this.creando.set(false);
    if (this.route.snapshot.queryParamMap.get('id')) {
      this.router.navigate([], { queryParams: { id: null }, queryParamsHandling: 'merge', replaceUrl: true });
    }
  }

  protected enviar(): void {
    if (!this.formValido()) return;
    this.enviando.set(true);
    this.errorForm.set(null);
    this.solicitudes
      .crear({
        tipo: this.tipo(),
        moduloCodigo: this.tipo() === 'ajuste_modulo' && this.moduloCodigo() ? this.moduloCodigo() : undefined,
        titulo: this.titulo().trim(),
        descripcion: this.descripcion().trim(),
      })
      .subscribe({
        next: (s) => {
          this.enviando.set(false);
          this.titulo.set('');
          this.descripcion.set('');
          this.moduloCodigo.set('');
          this.creando.set(false);
          this.abierta.set(s);
          this.cargar();
        },
        error: (err) => {
          this.enviando.set(false);
          this.errorForm.set(mensajeDeError(err));
        },
      });
  }

  protected comentar(): void {
    const s = this.abierta();
    const texto = this.comentario().trim();
    if (!s || !texto) return;
    this.comentando.set(true);
    this.solicitudes.comentar(s.id, texto).subscribe({
      next: (actualizada) => {
        this.comentando.set(false);
        this.comentario.set('');
        this.abierta.set(actualizada);
        this.cargar();
      },
      error: (err) => {
        this.comentando.set(false);
        this.errorDetalle.set(mensajeDeError(err));
      },
    });
  }

  protected retirar(): void {
    const s = this.abierta();
    if (!s) return;
    this.solicitudes.cancelar(s.id).subscribe({
      next: (actualizada) => {
        this.confirmandoRetiro.set(false);
        this.abierta.set(actualizada);
        this.cargar();
      },
      error: (err) => this.errorDetalle.set(mensajeDeError(err)),
    });
  }
}
