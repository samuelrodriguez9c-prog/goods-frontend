import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconCopy, IconLock, IconSend, IconX, TablerIconComponent } from '@tabler/icons-angular';
import { StatusBadgeComponent } from 'shared-ui';
import { AuthService } from '../../../../core/auth/auth.service';
import { ModuloService } from '../../../../core/catalog/modulo.service';
import { ModuloCatalogo } from '../../../../core/catalog/models/modulo.model';
import { formatFecha, formatMonto, mensajeDeError } from '../../../../core/facturacion/facturacion.service';
import {
  ALCANCE_SOLICITUD,
  AlcanceSolicitud,
  CambioEstadoPayload,
  ESTADO_SOLICITUD,
  EstadoSolicitud,
  SolicitudDetalle,
  TIPO_SOLICITUD,
  TipoSolicitud,
} from '../../../../core/solicitudes/models/solicitud.model';
import { SolicitudesService } from '../../../../core/solicitudes/solicitudes.service';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { PistaService } from '../../../../core/ui/pista.service';
import { PantallaEstadoComponent } from '../../../../shared/ui/pantalla-estado/pantalla-estado.component';

/** Texto del botón y de la explicación de cada transición. */
const ACCION: Record<EstadoSolicitud, { boton: string; explica: string; pideRespuesta: 'si' | 'opcional' | 'no' }> = {
  en_evaluacion: { boton: 'Tomar y evaluar', explica: 'Quedas como responsable. El cliente ve que ya la están revisando.', pideRespuesta: 'opcional' },
  aprobada: { boton: 'Aprobar…', explica: 'Decide si entra para todos o queda exclusiva (con costo) y cuéntale al cliente qué se va a hacer.', pideRespuesta: 'si' },
  rechazada: { boton: 'No aprobar…', explica: 'El cliente lee el motivo tal cual lo escribas.', pideRespuesta: 'si' },
  en_desarrollo: { boton: 'Empezar desarrollo', explica: 'Desde acá el cliente ya no la puede retirar.', pideRespuesta: 'opcional' },
  entregada: { boton: 'Marcar entregada…', explica: 'Si es un módulo, puedes activárselo a la Empresa en el mismo paso: su panel se actualiza solo.', pideRespuesta: 'opcional' },
  cancelada: { boton: 'Cancelar…', explica: 'Se cierra sin hacerse. El cliente lee el motivo.', pideRespuesta: 'si' },
  recibida: { boton: '', explica: '', pideRespuesta: 'no' },
};

/**
 * Detalle de una solicitud (staff): datos, historial completo (incluidas
 * las notas internas, marcadas), comentar (visible o interno), asignarse
 * y mover el estado con lo que cada transición exige (ver
 * `SolicitudService.cambiarEstado` del backend).
 */
@Component({
  selector: 'app-solicitud-detalle-panel',
  standalone: true,
  imports: [FormsModule, TablerIconComponent, StatusBadgeComponent, PantallaEstadoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './solicitud-detalle-panel.component.html',
})
export class SolicitudDetallePanelComponent {
  private readonly solicitudes = inject(SolicitudesService);
  private readonly modulosService = inject(ModuloService);
  private readonly auth = inject(AuthService);
  private readonly alertas = inject(AlertaService);
  private readonly pista = inject(PistaService);

  readonly solicitudId = input.required<number>();
  readonly puedeGestionar = input(false);
  readonly cerrar = output<void>();
  readonly enviando = output<void>();
  readonly cambio = output<void>();

  protected readonly i = { cerrar: IconX, copiar: IconCopy, enviar: IconSend, interno: IconLock };
  protected readonly formatFecha = formatFecha;
  protected readonly formatMonto = formatMonto;
  protected readonly estadoInfo = ESTADO_SOLICITUD;
  protected readonly tipoInfo = TIPO_SOLICITUD;
  protected readonly alcanceTexto = ALCANCE_SOLICITUD;
  protected readonly accion = ACCION;
  protected readonly alcances: { valor: AlcanceSolicitud; texto: string; ayuda: string }[] = [
    { valor: 'para_todos', texto: ALCANCE_SOLICITUD.para_todos, ayuda: 'Entra al producto, sin costo' },
    { valor: 'exclusiva', texto: ALCANCE_SOLICITUD.exclusiva, ayuda: 'Solo esta Empresa, con costo' },
  ];
  protected readonly tipos = Object.entries(TIPO_SOLICITUD).map(([valor, t]) => ({ valor: valor as TipoSolicitud, texto: t.texto }));

  protected readonly solicitud = signal<SolicitudDetalle | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly estadoPantalla = computed<'cargando' | 'error' | 'listo'>(() =>
    this.error() ? 'error' : this.solicitud() ? 'listo' : 'cargando',
  );
  protected readonly catalogo = signal<ModuloCatalogo[]>([]);

  // Comentario
  protected readonly comentario = signal('');
  protected readonly interno = signal(false);
  protected readonly comentando = signal(false);

  // Transición en curso
  protected readonly destino = signal<EstadoSolicitud | null>(null);
  protected readonly respuesta = signal('');
  protected readonly alcance = signal<AlcanceSolicitud>('para_todos');
  protected readonly costo = signal<number | null>(null);
  protected readonly tipoNuevo = signal<TipoSolicitud | ''>('');
  protected readonly moduloId = signal<number | null>(null);
  protected readonly activarModulo = signal(false);
  protected readonly fechaCompromiso = signal('');
  protected readonly guardando = signal(false);
  protected readonly errorAccion = signal<string | null>(null);
  // Agrupar (prioridad por demanda)
  protected readonly agrupando = signal(false);
  protected readonly principalId = signal<number | null>(null);
  protected readonly hoy = new Date().toISOString().slice(0, 10);
  protected readonly puedeAgrupar = computed(() => {
    const s = this.solicitud();
    return !!s && !s.agrupadaEn && s.alcance !== 'exclusiva' && s.agrupadas.length === 0 &&
      ['recibida', 'en_evaluacion', 'aprobada', 'en_desarrollo'].includes(s.estado);
  });

  protected readonly esMia = computed(() => this.solicitud()?.asignadaA?.id === this.auth.currentUser()?.id);

  protected readonly celdas = computed(() => {
    const s = this.solicitud();
    if (!s) return [];
    return [
      { etiqueta: 'Tipo', valor: `${TIPO_SOLICITUD[s.tipo].texto}${s.modulo ? ' · ' + s.modulo.nombre : ''}` },
      {
        etiqueta: 'Alcance',
        valor: s.alcance
          ? `${ALCANCE_SOLICITUD[s.alcance]}${s.alcance === 'exclusiva' && s.costoMensual !== null ? ` · ${formatMonto(s.costoMensual)}/mes` : ''}${s.fechaCompromiso ? ` · para el ${formatFecha(s.fechaCompromiso + 'T12:00:00')}` : ''}`
          : 'Sin decidir',
      },
      { etiqueta: 'Lo piden', valor: `${s.interesadas} ${s.interesadas === 1 ? 'Empresa' : 'Empresas'}` },
    ];
  });

  protected readonly eventos = computed(() =>
    (this.solicitud()?.eventos ?? []).map((e) => ({
      ...e,
      titulo:
        e.tipo === 'estado'
          ? e.estadoAnterior
            ? `${ESTADO_SOLICITUD[e.estadoAnterior].texto} → ${ESTADO_SOLICITUD[e.estadoNuevo!].texto}`
            : 'Creó la solicitud'
          : e.visibleCliente
            ? 'Comentario'
            : 'Nota interna',
      quien: e.autor?.nombre ?? (e.deGoods ? 'Goods' : 'Cliente'),
      lado: e.deGoods ? 'goods' : 'cliente',
    })),
  );

  protected readonly puedeConfirmar = computed(() => {
    const d = this.destino();
    if (!d || this.guardando()) return false;
    const r = this.respuesta().trim();
    if (ACCION[d].pideRespuesta === 'si' && r.length < 5) return false;
    if (d === 'aprobada' && this.alcance() === 'exclusiva' && (this.costo() === null || this.costo()! < 0)) return false;
    if (d === 'aprobada' && this.alcance() === 'exclusiva' && !this.fechaCompromiso()) return false;
    if (d === 'entregada' && this.activarModulo() && !this.moduloId()) return false;
    return true;
  });

  constructor() {
    queueMicrotask(() => this.cargar());
    this.modulosService.listarCatalogo().subscribe({ next: (m) => this.catalogo.set(m), error: () => this.catalogo.set([]) });
  }

  protected cargar(): void {
    this.error.set(null);
    this.solicitudes.obtener(this.solicitudId()).subscribe({
      next: (s) => this.solicitud.set(s),
      error: (err) => this.error.set(mensajeDeError(err, 'No se pudo cargar la solicitud.')),
    });
  }

  protected copiarId(): void {
    navigator.clipboard?.writeText(String(this.solicitudId()));
    this.pista.hecho(`Solicitud #${this.solicitudId()} copiada`);
  }

  protected iniciar(destino: EstadoSolicitud): void {
    const s = this.solicitud();
    this.destino.set(destino);
    this.respuesta.set('');
    this.errorAccion.set(null);
    this.alcance.set(s?.alcance ?? 'para_todos');
    this.costo.set(s?.costoMensual ?? null);
    this.tipoNuevo.set('');
    this.fechaCompromiso.set(s?.fechaCompromiso ?? '');
    this.moduloId.set(s?.modulo?.id ?? null);
    this.activarModulo.set(destino === 'entregada' && (s?.tipo === 'modulo_nuevo' || s?.alcance === 'exclusiva') && !!s?.modulo);
  }

  protected confirmar(): void {
    const s = this.solicitud();
    const d = this.destino();
    if (!s || !d || !this.puedeConfirmar()) return;
    const payload: CambioEstadoPayload = { estado: d };
    if (this.respuesta().trim()) payload.respuesta = this.respuesta().trim();
    if (d === 'aprobada') {
      payload.alcance = this.alcance();
      if (this.alcance() === 'exclusiva') {
        payload.costoMensual = this.costo() ?? 0;
        payload.fechaCompromiso = this.fechaCompromiso();
      }
      if (this.tipoNuevo()) payload.tipo = this.tipoNuevo() as TipoSolicitud;
      if (this.moduloId() && this.moduloId() !== s.modulo?.id) payload.moduloId = this.moduloId()!;
    }
    if (d === 'entregada' && this.activarModulo()) {
      payload.activarModulo = true;
      payload.moduloId = this.moduloId()!;
    }
    this.guardando.set(true);
    this.errorAccion.set(null);
    this.enviando.emit();
    this.alertas
      .seguir(this.solicitudes.cambiarEstado(s.id, payload), {
        titulo: 'Actualizando la solicitud',
        texto: `${s.empresaNombre} · ${ESTADO_SOLICITUD[d].texto}`,
        exito: {
          titulo: `Solicitud ${ESTADO_SOLICITUD[d].texto.toLowerCase()}`,
          texto: payload.activarModulo ? 'El módulo ya está activo en el panel del cliente.' : 'El cliente recibió el aviso.',
        },
        error: { titulo: 'No se pudo actualizar', texto: 'Revisa el detalle en el panel.' },
      })
      .subscribe({
        next: (actualizada) => {
          this.guardando.set(false);
          this.destino.set(null);
          this.solicitud.set(actualizada);
          this.cambio.emit();
        },
        error: (err) => {
          this.guardando.set(false);
          this.errorAccion.set(mensajeDeError(err));
        },
      });
  }

  protected agrupar(): void {
    const s = this.solicitud();
    const principal = this.principalId();
    if (!s || !principal) return;
    this.enviando.emit();
    this.errorAccion.set(null);
    this.solicitudes.agrupar(s.id, principal).subscribe({
      next: (p) => {
        this.agrupando.set(false);
        this.solicitud.set(p);
        this.pista.hecho(`Sumada a la #${p.id}: la piden ${p.interesadas} Empresas`);
        this.cambio.emit();
      },
      error: (err) => this.errorAccion.set(mensajeDeError(err)),
    });
  }

  protected desagrupar(id: number): void {
    this.enviando.emit();
    this.solicitudes.desagrupar(id).subscribe({
      next: () => {
        this.cargarId(this.solicitud()?.id ?? this.solicitudId());
        this.cambio.emit();
      },
      error: (err) => this.errorAccion.set(mensajeDeError(err)),
    });
  }

  protected abrirOtra(id: number): void {
    this.solicitud.set(null);
    this.cargarId(id);
  }

  private cargarId(id: number): void {
    this.solicitudes.obtener(id).subscribe({
      next: (s) => this.solicitud.set(s),
      error: (err) => this.error.set(mensajeDeError(err, 'No se pudo cargar la solicitud.')),
    });
  }

  protected comentar(): void {
    const s = this.solicitud();
    const texto = this.comentario().trim();
    if (!s || !texto || this.comentando()) return;
    this.comentando.set(true);
    this.enviando.emit();
    this.solicitudes.comentar(s.id, texto, !this.interno()).subscribe({
      next: (actualizada) => {
        this.comentando.set(false);
        this.comentario.set('');
        this.solicitud.set(actualizada);
        this.pista.hecho(this.interno() ? 'Nota interna guardada' : 'Comentario enviado al cliente');
        this.cambio.emit();
      },
      error: (err) => {
        this.comentando.set(false);
        this.errorAccion.set(mensajeDeError(err));
      },
    });
  }

  protected asignarme(quitar = false): void {
    const s = this.solicitud();
    const yo = this.auth.currentUser()?.id;
    if (!s || !yo) return;
    this.enviando.emit();
    this.solicitudes.asignar(s.id, quitar ? null : yo).subscribe({
      next: (actualizada) => {
        this.solicitud.set(actualizada);
        this.cambio.emit();
      },
      error: (err) => this.errorAccion.set(mensajeDeError(err)),
    });
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.cerrar.emit();
  }
}
