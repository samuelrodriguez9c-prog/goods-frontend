import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * Bloquea una ruta si el plan de la Empresa no tiene el módulo `codigo` y
 * manda al Dashboard.
 *
 * @remarks
 * Es solo UX: quien impide el acceso es `ModuloGuard` en el backend (403).
 * Al entrar por URL, `currentUser` puede seguir en `null` porque el Shell lo
 * pide en paralelo; en ese caso se carga el perfil acá antes de decidir.
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
