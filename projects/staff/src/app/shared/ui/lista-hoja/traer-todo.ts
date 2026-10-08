import { Observable, forkJoin, map, of, switchMap } from 'rxjs';

/** Lo mínimo de una respuesta paginada del backend (`data` + `total`). */
interface Pagina<T> {
  data: T[];
  total: number;
}

/** El tope de `pageSize` del backend (`PaginationQueryDto`). */
export const TAMANO_PAGINA = 100;

/**
 * Trae TODAS las páginas de un listado (2026-10-07): pide la primera y,
 * con el total, el resto en paralelo de a `TAMANO_PAGINA`. Para listados
 * que crecen con la cantidad de clientes (Empresas, Suscripciones, altas,
 * solicitudes abiertas), que antes se cortaban en las primeras 100 filas.
 * Lo que crece sin tope con el tiempo (pagos, solicitudes cerradas) NO usa
 * esto: se carga lo reciente y el resto con "Cargar más".
 *
 * `tope` evita traer de más por error (avisa con `cortado`).
 */
export function traerTodo<T>(
  pedir: (page: number, pageSize: number) => Observable<Pagina<T>>,
  tope = 10_000,
): Observable<{ data: T[]; total: number; cortado: boolean }> {
  return pedir(1, TAMANO_PAGINA).pipe(
    switchMap((primera) => {
      const paginas = Math.ceil(Math.min(primera.total, tope) / TAMANO_PAGINA);
      if (paginas <= 1) return of({ data: primera.data, total: primera.total, cortado: primera.total > primera.data.length && primera.total > tope });
      const resto = Array.from({ length: paginas - 1 }, (_, i) => pedir(i + 2, TAMANO_PAGINA));
      return forkJoin(resto).pipe(
        map((otras) => {
          // Por si algo cambió entre páginas: sin repetidos por `id`.
          const vistos = new Set<unknown>();
          const data = [primera, ...otras]
            .flatMap((p) => p.data)
            .filter((x) => {
              const id = (x as { id?: unknown }).id;
              if (id === undefined) return true;
              if (vistos.has(id)) return false;
              vistos.add(id);
              return true;
            });
          return { data, total: primera.total, cortado: primera.total > tope };
        }),
      );
    }),
  );
}
