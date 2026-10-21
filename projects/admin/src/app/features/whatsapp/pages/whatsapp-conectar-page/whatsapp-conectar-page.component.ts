import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
import {
  IconAlertTriangle,
  IconArrowsExchange,
  IconBrandFacebook,
  IconBrandWhatsapp,
  IconCheck,
  IconClock,
  IconDeviceMobile,
  IconLock,
  IconMessages,
  IconPlugConnectedX,
  IconSparkles,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { AuthService } from '../../../../core/auth/auth.service';
import { mensajeDeError } from '../../../../core/solicitudes/solicitudes.service';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { abrirRegistroIntegrado } from '../../../../core/whatsapp/registro-integrado';
import { EstadoConexion, formatearNumero } from '../../../../core/whatsapp/whatsapp.model';
import { WhatsappService } from '../../../../core/whatsapp/whatsapp.service';
import { WhatsappModuloStore } from '../../shared/whatsapp-modulo.store';
import { ConexionManualComponent, DatosConexionManual } from './components/conexion-manual/conexion-manual.component';

/** Los tres pasos; `paso` = cuántos ya terminaron (0–3). */
const PASOS: [string, string][] = [
  ['Entra con Facebook', 'Usa la cuenta de Facebook que administra el negocio.'],
  ['Elige tu número', 'El de WhatsApp Business. Te llega un código para confirmarlo.'],
  ['Listo', 'Los mensajes nuevos empiezan a llegar a la bandeja de Goods.'],
];
const TEXTO_CONECTANDO = ['Abriendo Facebook…', 'Confirmando el número…', 'Trayendo tus chats…', '¡Conectado!'];
const COSTOS: { k: string; d: string; v: string; color: string }[] = [
  { k: 'Responder en 24 h', d: 'Desde el último mensaje del cliente', v: 'Gratis', color: '#1d8a4b' },
  { k: 'Plantilla de servicio', d: 'Pedido listo, entrega, cotización', v: '≈ $4', color: '#111827' },
  { k: 'Plantilla de promoción', d: 'Campañas y ofertas', v: '≈ $52', color: '#111827' },
  { k: 'Goods', d: 'Bandeja, IA y campañas', v: 'En tu plan', color: '#00857e' },
];
/** Cuánto se ve "¡Conectado!" (puente verde) antes de pasar a la Bandeja. */
const MS_FESTEJO = 900;

/**
 * WhatsApp · «Conectar número»: lo que ve el negocio sin número conectado
 * (o con el número desconectado). Lo monta `WhatsappShellComponent`, que
 * además oculta la cabecera con las secciones (Bandeja / Plantillas /
 * Automático / Campañas) mientras no haya número.
 *
 * - Tarjeta de 2 columnas (se apilan solas en angosto):
 *   · izquierda: título, "ten a mano" (3 chips), los 3 pasos, el botón de
 *     Facebook y la conexión manual plegable;
 *   · derecha (#f6f6f4): el puente celular ⇄ Goods que se llena con el
 *     avance y una vista previa de cómo llegan los chats.
 * - Debajo, la franja "Lo que cuesta".
 *
 * `paso` avanza con la conexión real: 0 ventana de Facebook abierta · 1 número
 * confirmado (vuelve el registro integrado) · 2 trayendo los chats (POST al
 * backend) · 3 listo. También cubre: WhatsApp aún no habilitado en Goods,
 * sin permiso (solo el dueño), número desconectado con los chats guardados y
 * registro integrado sin configurar (queda abierta la conexión a mano).
 */
@Component({
  selector: 'app-whatsapp-conectar-page',
  imports: [TablerIconComponent, ConexionManualComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './whatsapp-conectar-page.component.html',
  host: { class: 'block leading-[normal]' },
})
export class WhatsappConectarPageComponent {
  protected readonly store = inject(WhatsappModuloStore);
  private readonly whatsapp = inject(WhatsappService);
  private readonly auth = inject(AuthService);
  private readonly alertas = inject(AlertaService);
  private readonly manualRef = viewChild(ConexionManualComponent);

  protected readonly i = {
    fb: IconBrandFacebook,
    wa: IconBrandWhatsapp,
    check: IconCheck,
    messages: IconMessages,
    sparkles: IconSparkles,
    exchange: IconArrowsExchange,
    error: IconAlertTriangle,
    desconectado: IconPlugConnectedX,
    espera: IconClock,
    candado: IconLock,
  };
  protected readonly requisitos = [
    { icono: IconBrandFacebook, t: 'La cuenta de Facebook que administra el negocio' },
    { icono: IconBrandWhatsapp, t: 'Tu número de WhatsApp Business' },
    { icono: IconDeviceMobile, t: 'El celular a mano para el código' },
  ];
  protected readonly costos = COSTOS;

  protected readonly puedeConfigurar = computed(() => (this.auth.currentUser()?.permisos ?? []).includes('whatsapp.configurar'));
  protected readonly conexion = this.store.conexion;
  /** Tuvo un número y lo desconectó: los chats siguen guardados. */
  protected readonly desconectado = computed(() => !!this.conexion()?.cuenta);
  protected readonly numeroAnterior = computed(() => {
    const n = this.conexion()?.cuenta?.numero;
    return n ? formatearNumero(n.replace(/\D/g, '')) : null;
  });

  protected readonly conectando = signal<'meta' | 'manual' | null>(null);
  protected readonly paso = signal(0);
  protected readonly errorConexion = signal<string | null>(null);
  /** Sin registro integrado, la conexión a mano es la única salida: abre sola. */
  protected readonly modoPrueba = signal(!this.store.conexion()?.registroIntegrado);

  protected readonly pasos = computed(() =>
    PASOS.map(([titulo, texto], n) => {
      const hecho = this.paso() > n;
      const activo = this.paso() === n && !!this.conectando();
      return {
        n: n + 1,
        titulo,
        texto,
        hecho,
        ultimo: n === PASOS.length - 1,
        bg: hecho ? '#2be0d5' : activo ? '#303030' : '#f1f1f1',
        fg: hecho ? '#003331' : activo ? '#ffffff' : '#6b7280',
        linea: hecho ? '#2be0d5' : '#ececec',
      };
    }),
  );
  /** El botón de Facebook se puede usar: habilitado, con permiso y con registro integrado. */
  protected readonly puedeConectarMeta = computed(
    () => !!this.conexion()?.disponible && this.puedeConfigurar() && !!this.conexion()?.registroIntegrado,
  );
  protected readonly textoBoton = computed(() => {
    if (this.conectando() === 'meta' || (this.conectando() === 'manual' && this.paso() >= 3)) return TEXTO_CONECTANDO[Math.min(this.paso(), 3)];
    if (!this.puedeConfigurar()) return 'Pídele al dueño que conecte el número';
    return 'Conectar con Facebook';
  });
  protected readonly puentePct = computed(() => Math.min(100, (this.paso() / 3) * 100));
  protected readonly listo = computed(() => this.paso() >= 3);

  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor() {
    // La miga ("WhatsApp" sin sección) la maneja el marco del módulo.
    inject(DestroyRef).onDestroy(() => this.timers.forEach(clearTimeout));
  }

  protected async conectarConMeta(): Promise<void> {
    const ri = this.conexion()?.registroIntegrado;
    if (!ri || this.conectando() || !this.puedeConectarMeta()) return;
    this.conectando.set('meta');
    this.paso.set(0);
    this.errorConexion.set(null);
    try {
      const r = await abrirRegistroIntegrado(ri);
      this.paso.set(1);
      this.timers.push(setTimeout(() => this.paso() === 1 && this.paso.set(2), 500));
      this.whatsapp.conectar(r).subscribe({
        next: (c) => this.terminar(c),
        error: (e) => this.fallo(mensajeDeError(e)),
      });
    } catch (e) {
      this.fallo(e instanceof Error ? e.message : 'No se pudo conectar.');
    }
  }

  protected conectarManual(datos: DatosConexionManual): void {
    if (this.conectando()) return;
    this.conectando.set('manual');
    this.paso.set(2);
    this.errorConexion.set(null);
    this.whatsapp.conectarManual(datos).subscribe({ next: (c) => this.terminar(c), error: (e) => this.fallo(mensajeDeError(e)) });
  }

  /** Puente en verde y "¡Conectado!" un momento; después, la Bandeja. */
  private terminar(c: EstadoConexion): void {
    this.paso.set(3);
    this.manualRef()?.limpiarToken();
    this.alertas.mostrar({ estado: 'success', titulo: 'Número conectado', texto: 'Ya puedes responder desde Goods.' });
    this.timers.push(
      setTimeout(() => {
        this.conectando.set(null);
        this.store.conexion.set(c);
        this.store.cargarResumen();
      }, MS_FESTEJO),
    );
  }

  /** El error queda escrito bajo el botón (sin alerta aparte: era el mismo mensaje dos veces). */
  private fallo(mensaje: string): void {
    this.conectando.set(null);
    this.paso.set(0);
    this.errorConexion.set(mensaje);
  }
}
