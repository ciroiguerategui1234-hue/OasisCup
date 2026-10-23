// Oasis Cup × mirabella · configuración (lo que cambia el organizador)
window.OASIS = {
  // URL de la app de Google Apps Script (ver LEEME). Vacío = modo demostración (los datos quedan en el navegador).
  API_URL: '',

  INSTAGRAM: 'oasisparty.pm',
  PRECIO_TOTAL: 250000,
  PRECIO_SENA: 125000,
  ALIAS: '[ALIAS O CVU a confirmar]',
  TITULAR: '[Titular de la cuenta]',
  CIERRE_INSCRIPCION: 'hasta completar el cupo',
  // Hasta esta fecha se eligen color y talles. Después: color asignado y talles genéricos.
  ELECCION_HASTA: '2026-11-30T23:59:59-03:00',
  ELECCION_TEXTO: '30 de noviembre',
  TALLES_GENERICOS: 'S a XL',
  RESERVA_HORAS: 48,
  CUPO: { masculino: 12, femenino: 6 },          // máximo de equipos por categoría
  CUPO_TEXTO: { masculino: 'De 8 a 12 equipos, según la demanda', femenino: 'Hasta 6 equipos' },
  INICIO: '2027-01-07T09:00:00-03:00',          // para la cuenta regresiva
  SEDE: 'Club Atlético Guillermo Brown',
  SEDE_MAPA: 'Club Social y Atlético Guillermo Brown, Puerto Madryn, Chubut',

  JUGADORES_MIN: 8,
  JUGADORES_MAX: 10,
  TALLES: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],

  // Colores de camiseta disponibles en cada categoría
  COLORES: [
    { id: 'marino',  n: 'Azul marino', hex: '#1D2F52' },
    { id: 'verde',   n: 'Verde',       hex: '#1E5A3A' },
    { id: 'bordo',   n: 'Bordó',       hex: '#7A1F24' },
    { id: 'celeste', n: 'Celeste',     hex: '#5B8FD1' },
    { id: 'marron',  n: 'Marrón',      hex: '#5A3A2A' },
    { id: 'gris',    n: 'Gris',        hex: '#A4A8AE' },
    { id: 'agua',    n: 'Verde agua',  hex: '#9CCB9E' },
    { id: 'salmon',  n: 'Salmón',      hex: '#E09080' },
    { id: 'blanco',  n: 'Blanco',      hex: '#EEF0F3' }
  ],
  // Todos los arqueros usan el mismo color, distinto al de los equipos
  ARQUERO: { n: 'Color a definir', hex: null }   // cuando lo definan: { n: 'Amarillo flúor', hex: '#DCEB3A' }
};
