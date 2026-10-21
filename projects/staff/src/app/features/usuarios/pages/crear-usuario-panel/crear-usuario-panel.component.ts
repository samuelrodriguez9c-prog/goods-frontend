import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IconBuildingStore,
  IconCircle,
  IconCircleCheckFilled,
  IconHistory,
  IconLayoutGrid,
  IconPhoneCall,
  IconReceipt,
  IconSend,
  IconUserPlus,
  IconUsers,
  IconX,
  TablerIconComponent,
  type TablerIcon,
} from '@tabler/icons-angular';
import { Rol } from '../../../../core/roles/models/rol.model';
import { UsuarioGoods } from '../../../../core/usuarios/models/usuario.model';
import { UsuarioService } from '../../../../core/usuarios/usuario.service';
import { AlertaService } from '../../../../core/ui/alerta.service';

interface ModuloDef {
  id: string;
  completo: string;
  icono: TablerIcon;
  codigos?: string[];
}

/** Copia local de las columnas de la matriz: este panel no importa nada de
 * `usuarios-page`. Debe mantenerse igual a `MODULOS` de
 * `usuarios-page.component.ts`, incluido el ajuste de `codigos` de "Altas
 * pendientes" (esos permisos están bajo `modulo: 'empresas'`). */
const MODULOS: ModuloDef[] = [
  { id: 'empresas', completo: 'Empresas', icono: IconBuildingStore },
  {
    id: 'altas',
    completo: 'Altas pendientes',
    icono: IconPhoneCall,
    codigos: ['empresas.activar', 'empresas.rechazar', 'empresas.gestionar_alta'],
  },
  { id: 'planes', completo: 'Planes', icono: IconLayoutGrid },
  { id: 'suscripciones', completo: 'Suscripciones', icono: IconReceipt },
  { id: 'auditoria', completo: 'Auditoría', icono: IconHistory },
  { id: 'usuarios', completo: 'Usuarios', icono: IconUsers },
];
const VERBOS_TOTALES = ['eliminar', 'rechazar', 'desactivar', 'gestionar', 'gestionar_alta'];
const NIVEL = ['Sin acceso', 'Solo ver', 'Editar', 'Todo'];
const TONO = ['#ececec', '#6b7280', '#66b39b', '#087b5d'];
const TINTA_NIVEL = ['text-gray-300', 'text-gray-500', 'text-badge-success-solid', 'text-[#065f46]'];
const ETIQUETA_ROL: Record<string, string> = {
  admin: 'Administrador',
  staff_goods: 'Staff Goods',
  admin_goods: 'Admin de Goods',
  auditoria_goods: 'Auditoría de Goods',
  empleado_goods: 'Empleado de Goods',
  cliente: 'Cliente',
  dueno_empresa: 'Dueño de la Empresa',
  empleado_empresa: 'Empleado de la Empresa',
};

/** Copia local de `etiquetaRolTexto()` de `usuarios-page.component.ts`: un
 * rol fuera de la lista se muestra con cada palabra capitalizada en vez del
 * slug. */
function etiquetaRolTexto(nombre: string): string {
  return (
    ETIQUETA_ROL[nombre] ??
    nombre
      .split(/[_-]+/)
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' ')
  );
}

interface FormularioAlta {
  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string;
  password: string;
  password2: string;
  rolId: number | null;
}

const FORMULARIO_VACIO: FormularioAlta = {
  nombres: '',
  apellidos: '',
  correo: '',
  telefono: '',
  password: '',
  password2: '',
  rolId: null,
};

/**
 * Panel para dar de alta a una persona, con la vista previa de lo que concede
 * el rol elegido. Es autónomo (la persona aún no está en la matriz), por eso
 * duplica `MODULOS`/`nivelDe()` en vez de recibir la vista previa armada.
 *
 * Las reglas de contraseña (`requisitos`) son más estrictas que las del
 * backend (`CreateUsuarioDto` solo exige 8 caracteres) a propósito: no las
 * relajes para igualarlas. Los avisos de éxito o error los muestra el propio
 * panel con `AlertaService.seguir()`.
 */
@Component({
  selector: 'app-crear-usuario-panel',
  standalone: true,
  imports: [FormsModule, TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './crear-usuario-panel.component.html',
})
export class CrearUsuarioPanelComponent {
  private readonly usuarioService = inject(UsuarioService);
  private readonly alertas = inject(AlertaService);

  protected readonly iconUserPlus = IconUserPlus;
  protected readonly iconCerrar = IconX;
  protected readonly iconEnviar = IconSend;
  protected readonly iconOk = IconCircleCheckFilled;
  protected readonly iconVacio = IconCircle;

  readonly roles = input.required<Rol[]>();
  readonly rolPreseleccionado = input<Rol | undefined>(undefined);

  readonly cerrar = output<void>();
  readonly creado = output<UsuarioGoods>();

  protected readonly guardando = signal(false);
  // `rolId` arranca en `null` porque los signal inputs aún no tienen valor
  // al inicializar los campos (NG0950); el valor por defecto lo resuelve
  // `rolIdEfectivo`.
  protected readonly formulario = signal<FormularioAlta>({ ...FORMULARIO_VACIO });

  /** `formulario().rolId` es la elección explícita del usuario (si la
   * hizo); si todavía no eligió nada, el valor efectivo es el rol
   * preseleccionado (venir de "Agregar a alguien como X") o `staff_goods`
   * por defecto. */
  protected readonly rolIdEfectivo = computed(
    () =>
      this.formulario().rolId ??
      this.rolPreseleccionado()?.id ??
      this.roles().find((r) => r.nombre === 'staff_goods')?.id ??
      null,
  );

  private nivelDe(rol: Rol | undefined, modulo: ModuloDef): number {
    if (!rol) {
      return 0;
    }
    const codigos = modulo.codigos
      ? rol.permisos.filter((p) => modulo.codigos!.includes(p.codigo)).map((p) => p.codigo.split('.')[1] ?? '')
      : rol.permisos
          .filter((p) => (p.modulo ?? p.codigo.split('.')[0]) === modulo.id)
          .map((p) => p.codigo.split('.')[1] ?? '');
    if (!codigos.length) {
      return 0;
    }
    if (codigos.some((v) => VERBOS_TOTALES.includes(v))) {
      return 3;
    }
    return codigos.some((v) => v !== 'ver') ? 2 : 1;
  }

  protected etiquetaRol(rol: Rol): string {
    return etiquetaRolTexto(rol.nombre);
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cerrar.emit();
    }
  }

  protected actualizarCampo(campo: keyof FormularioAlta, valor: string): void {
    this.formulario.update((f) => ({ ...f, [campo]: valor }));
  }

  protected elegirRolAlta(rol: Rol): void {
    this.formulario.update((f) => ({ ...f, rolId: rol.id }));
  }

  protected readonly requisitos = computed(() => {
    const p = this.formulario().password;
    return [
      { texto: '8 caracteres', ok: p.length >= 8 },
      { texto: 'Una mayúscula', ok: /[A-ZÁÉÍÓÚÑ]/.test(p) },
      { texto: 'Un número', ok: /[0-9]/.test(p) },
      { texto: 'Un símbolo', ok: /[^A-Za-z0-9ÁÉÍÓÚÑáéíóúñ\s]/.test(p) },
    ];
  });

  protected readonly fuerza = computed(() => {
    const f = this.formulario();
    const cumplidos = this.requisitos().filter((r) => r.ok).length;
    const nivel = f.password.length === 0 ? 0 : cumplidos;
    const escala = [
      { texto: 'Escribe una contraseña', tinta: 'text-gray-400', color: '#ececec' },
      { texto: 'Muy débil', tinta: 'text-badge-error-solid', color: '#d82c0d' },
      { texto: 'Débil', tinta: 'text-[#b45309]', color: '#ffb904' },
      { texto: 'Casi', tinta: 'text-[#b45309]', color: '#ffb904' },
      { texto: 'Segura', tinta: 'text-badge-success-solid', color: '#087b5d' },
    ];
    return {
      nivel,
      texto: escala[nivel].texto,
      tinta: escala[nivel].tinta,
      barras: [0, 1, 2, 3].map((i) => (i < nivel ? escala[nivel].color : '#ececec')),
    };
  });

  protected readonly coinciden = computed(() => {
    const f = this.formulario();
    return f.password2.length > 0 && f.password === f.password2;
  });

  protected readonly noCoinciden = computed(() => {
    const f = this.formulario();
    return f.password2.length > 0 && f.password !== f.password2;
  });

  protected readonly puedeCrear = computed(() => {
    const f = this.formulario();
    return (
      f.nombres.trim().length > 0 &&
      f.apellidos.trim().length > 0 &&
      f.correo.trim().length > 0 &&
      this.rolIdEfectivo() !== null &&
      this.requisitos().every((r) => r.ok) &&
      f.password === f.password2 &&
      !this.guardando()
    );
  });

  protected readonly previsualizacion = computed(() => {
    const rol = this.roles().find((r) => r.id === this.rolIdEfectivo());
    return MODULOS.map((m) => {
      const n = this.nivelDe(rol, m);
      return {
        modulo: m.completo,
        icono: m.icono,
        texto: NIVEL[n],
        tinta: TINTA_NIVEL[n],
        s1: n >= 1 ? TONO[n] : '#ececec',
        s2: n >= 2 ? TONO[n] : '#ececec',
        s3: n >= 3 ? TONO[n] : '#ececec',
      };
    });
  });

  /** `POST /usuarios` siempre crea con el rol por defecto del backend
   * (`resolverRolIdInicial`), así que si el rol elegido es otro se encadena
   * `PATCH /usuarios/:id/rol`. Si ese segundo paso falla, la cuenta queda
   * creada igual con el rol por defecto. */
  protected crearUsuario(): void {
    const f = this.formulario();
    const rolId = this.rolIdEfectivo();
    if (!this.puedeCrear() || rolId === null) {
      return;
    }
    const rolElegido = this.roles().find((r) => r.id === rolId);
    const nombreCompleto = `${f.nombres} ${f.apellidos}`.trim();

    this.guardando.set(true);
    this.alertas
      .seguir(
        this.usuarioService.crear({
          nombres: f.nombres.trim(),
          apellidos: f.apellidos.trim(),
          correo: f.correo.trim(),
          telefono: f.telefono.trim() || undefined,
          password: f.password,
        }),
        {
          titulo: 'Creando la cuenta',
          texto: nombreCompleto,
          exito: {
            titulo: `${f.nombres} ya puede entrar como ${rolElegido ? this.etiquetaRol(rolElegido) : 'usuario'}`,
          },
          error: { titulo: 'No se pudo crear el usuario', texto: 'Revisa que el correo no esté en uso.' },
        },
      )
      .subscribe({
        next: (creado) => {
          if (rolId !== creado.rolId) {
            this.alertas
              .seguir(this.usuarioService.cambiarRol(creado.id, rolId), {
                titulo: 'Asignando el rol',
                texto: creado.nombres,
                exito: { titulo: 'Rol asignado' },
                error: {
                  titulo: 'No se pudo asignar el rol elegido',
                  texto: 'Cámbialo desde su ficha.',
                },
              })
              .subscribe({
                next: (conRol) => this.finalizarAlta(conRol),
                error: () => this.finalizarAlta(creado),
              });
          } else {
            this.finalizarAlta(creado);
          }
        },
        error: () => {
          this.guardando.set(false);
        },
      });
  }

  private finalizarAlta(usuario: UsuarioGoods): void {
    this.guardando.set(false);
    this.creado.emit(usuario);
  }
}
