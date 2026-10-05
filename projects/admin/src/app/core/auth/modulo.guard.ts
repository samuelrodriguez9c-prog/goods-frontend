import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * Bloquea una ruta si la Empresa logueada no tiene el módulo `codigo` en
 * su plan (`CurrentUser.modulosDisponibles`) y redirige al Dashboard.
 *
 * Igual que el filtro del sidebar, es UX: quien de verdad impide el acceso
 * es `ModuloGuard` en el backend (403). Esto solo evita caer en una
 * pantalla que va a fallar si alguien escribe la URL a mano.
 *
 * Si se entra directo a la URL (refresh), `currentUser` todavía puede ser
 * `null` porque el Shell lo pide en paralelo: en ese caso se carga el
 * perfil acá antes de decidir.
 */
export const moduloGuard = (codigo: string): CanActivateFn => () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const decidir = (modulos: string[]) =>
    modulos.includes(codigo) ? true : router.parseUrl('/');

  const usuario = authService.currentUser();
  if (usuario) {
    return decidir(usuario.modulosDisponibles ?? []);
  }
  return authService.cargarPerfil().pipe(
    map((perfil) => decidir(perfil.modulosDisponibles ?? [])),
    catchError(() => of(router.parseUrl('/'))),
  );
};
