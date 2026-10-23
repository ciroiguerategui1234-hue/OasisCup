# Conectar la web con la planilla OASIS CUP

1. Abrí la planilla **OASIS CUP** y andá a **Extensiones > Apps Script**.
2. Borrá lo que aparezca y pegá todo el contenido de `Codigo.gs`. Guardá (ícono de disquete).
3. Arriba, en el selector de funciones, elegí **configurar** y tocá **Ejecutar**.
   Google pide permisos: Revisar permisos > tu cuenta > Configuración avanzada > Ir a (proyecto) > Permitir.
   Esto crea las pestañas Inscripciones, Jugadores, Fixture web y Resumen. No toca las que ya existen.
4. **Implementar > Nueva implementación**. En el engranaje elegí **Aplicación web**.
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
   Tocá **Implementar** y copiá la URL que termina en `/exec`.
5. Esa URL va en `config.js`, en `API_URL`.
6. Opcional: elegí **borrarEquiposDeCostos** y tocá **Ejecutar** para vaciar la lista de equipos de la pestaña Costos (deja títulos y montos).

## Fixture web
Una fila por partido: Categoría (Masculino o Femenino), Día (7, 8 o 9, o la fecha), Hora (20:30), Equipo A, Goles A, Goles B, Equipo B, Fase (Zona A, Zona B, Semifinal, Final) y Cancha.
La página arma sola las posiciones de cada zona con los partidos que tengan goles cargados.

## Día a día
- Cada inscripción entra como **Pendiente de pago** en la pestaña Inscripciones, y los jugadores en Jugadores. Te llega un mail.
- Cuando llega el comprobante, cambiá **Estado** a **Seña pagada** o **Pagado**. Si en 48 horas no pagan, el color se libera solo.
- **Cancelado** libera el color al instante.
- Para publicar partidos y resultados, cargá filas en **Fixture web**: aparecen en la página.
- Si cambiás el código, volvé a Implementar > Administrar implementaciones > editar > Nueva versión, para no cambiar la URL.
