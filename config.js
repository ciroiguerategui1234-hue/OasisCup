// Oasis Cup × mirabella · configuración (lo que cambia el organizador)
window.OASIS = {
  // Las inscripciones se mandan a este Formulario de Google (nadie lo ve: la web lo completa sola)
  FORM_URL: 'https://docs.google.com/forms/d/e/1FAIpQLSetuvSNR15BQ73iyWDzBnZolvnXGfponQ8LGeMLz_n8mdliTw/formResponse',
  FORM_CAMPOS: { codigo: 'entry.1944162448', categoria: 'entry.1509108166', equipo: 'entry.455621616', capitan: 'entry.286392889', whatsapp: 'entry.1622412799', camiseta: 'entry.96980697', pago: 'entry.1264538432', jugadores: 'entry.1835525223' },
  // La pestaña "Para la web (no tocar)" de la planilla, publicada como CSV (sin datos personales)
  PLANILLA_CSV: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQx0K-StOXrmbD1HGFMkk2PkBKMP9i9McTiLjeN47lXxG-_4SMs7wWIalBll-8PO_fW0Mlh4GZRnmGY/pub?gid=697942810&single=true&output=csv',

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
  SALDO_HASTA: '6 de enero',                   // el resto se paga hasta un día antes del torneo
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
