# Conexión con la planilla

La web guarda las inscripciones con la función de Vercel `api/inscripciones.js`, que escribe en la planilla
"Oasis Cup · Inscripciones web" usando una cuenta de servicio de Google.
(El script de Apps Script de esta carpeta quedó como alternativa; no hace falta usarlo.)

Variables en Vercel (Settings > Environment Variables):
- GOOGLE_CLIENT_EMAIL: email de la cuenta de servicio
- GOOGLE_PRIVATE_KEY: el valor de "private_key" del archivo JSON de la clave
- SHEET_ID (opcional): id de otra planilla

La planilla tiene que estar compartida como Editor con el email de la cuenta de servicio.
