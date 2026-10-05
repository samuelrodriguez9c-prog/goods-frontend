import { HttpResponse } from '@angular/common/http';

/**
 * Descarga un archivo que devolvió la API (`responseType: 'blob'`,
 * `observe: 'response'`). El nombre sale del `Content-Disposition` del
 * backend; `porDefecto` si no viene (o si un proxy lo quita).
 */
export function descargarRespuesta(res: HttpResponse<Blob>, porDefecto: string): void {
  const disposicion = res.headers.get('Content-Disposition') ?? '';
  const nombre = /filename="?([^";]+)"?/.exec(disposicion)?.[1] ?? porDefecto;
  if (res.body) descargarBlob(res.body, nombre);
}

export function descargarBlob(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * CSV armado en el navegador (para listados que ya están en memoria, como
 * Empresas). Mismo formato que el backend (`common/csv.util.ts`): `;`, BOM
 * UTF-8 y decimales con coma, para que Excel en español lo abra bien.
 */
export function descargarCsv(nombreBase: string, encabezados: string[], filas: (string | number | null | undefined)[][]): void {
  const celda = (v: string | number | null | undefined): string => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v).replace('.', ',');
    return /[";\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const csv = '﻿' + [encabezados, ...filas].map((f) => f.map(celda).join(';')).join('\r\n') + '\r\n';
  const hoy = new Date();
  const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  descargarBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${nombreBase}-${fecha}.csv`);
}
