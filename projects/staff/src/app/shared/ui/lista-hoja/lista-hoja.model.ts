import { IconCircle } from '@tabler/icons-angular';

export type Icono = typeof IconCircle;

/** Barrita de la derecha de cada fila (días, meses cubiertos, etc.). */
export interface GaugeFila {
  texto: string;
  /** `null` = solo texto, sin barra. */
  ancho: number | null;
  color: string;
  tinta: string;
}

export interface FilaLista {
  id: number;
  nombre: string;
  sub: string;
  /** Color del tick vertical de 3px. */
  punto: string;
  gauge: GaugeFila;
}

export interface GrupoLista {
  clave: string;
  titulo: string;
  sub: string;
  icono: Icono;
  /** Color del ícono / fondo del círculo de 22px. */
  color: string;
  fondo: string;
  filas: FilaLista[];
  /** Texto del botón "Cargar más" al final del grupo (lo que se trae por partes); `null`/ausente = no hay más. */
  mas?: string | null;
  /** Mientras se trae la página siguiente. */
  cargandoMas?: boolean;
}

/** Pestañas de la hoja (118px cada una, indicador deslizante). */
export interface PestanaHoja {
  clave: string;
  texto: string;
  cuenta?: string | number | null;
  /** `alerta` = contador rojo (`#fde2dd`/`#b42318`). */
  alerta?: boolean;
}
