# Demo AIRGO EXPRESS - Lunes 16 Marzo 2026

## Credenciales

### LUCI (Aduanas) - https://aduanas.strixai.es
| Email | Nombre | Rol | Password |
|-------|--------|-----|----------|
| bvillanueva@airgoexpress.com | Borja Villanueva | admin | AirgoDemo2026 |
| jsendarrubias@airgoexpress.com | J Sendarrubias | agent | AirgoDemo2026 |
| marcomula@airgoexpress.com | Marco Mula | agent | AirgoDemo2026 |
| mquintana@airgoexpress.com | Manel Quintana | admin | AirgoDemo2026 |
| aarriaga@airgoexpress.com | A Arriaga | agent | AirgoDemo2026 |

**Tenant**: AIRGO EXPRESS (B84285923, ESB84285923)

### AXEL (Cotizaciones Transporte) - https://axel.strixai.es
| Email | Nombre | Password |
|-------|--------|----------|
| emendez@airgoexpress.com | Eduardo Mendez | AirgoAxel2026 |

## Guion de la Demo

### Parte 1: Importar Manifiesto (5 min) - LO QUE MAS LES INTERESA
1. Login como bvillanueva@airgoexpress.com
2. Ir a H7 E-commerce en el sidebar
3. Click "Importar Manifiesto"
4. Subir `manifiesto_ejemplo_airgo.csv` (27 envios)
5. Mostrar preview de las filas detectadas
6. Click "Clasificar con IA"
7. **MOMENTO WOW**: La IA clasifica los 27 envios en segundos, asignando codigos HS
8. Mostrar resultados: 25 listos para H7 (verde), 2 requieren H1 (naranja, valor >150 EUR)
9. Click "Crear 25 declaraciones H7"
10. Las 25 H7 aparecen en el listado

### Parte 2: Envio H7 a AEAT PRE (3 min)
1. Seleccionar una H7 del listado
2. Mostrar los datos precargados (tracking, remitente China, destinatario Espana, HS code)
3. Click "Enviar a AEAT"
4. Esperar respuesta (5-10 seg)
5. Mostrar MRN recibido y canal asignado

### Parte 3: H1 para envios >150 EUR (2 min)
1. Mostrar los 2 envios que la IA marco como H1 (lineas 26-27: discos duros 180 EUR, semiconductores 250 EUR)
2. Ir a Expediciones > Crear H1
3. Mostrar que el flujo H1 completo tambien funciona

### Parte 4: Chat con IA (2 min)
1. Abrir chat LUCI
2. Preguntar: "Necesito importar 500 fundas de movil desde China, valor 1200 EUR total. Como lo declaro?"
3. La IA responde con el procedimiento correcto

### Parte 5: Clasificacion TARIC (2 min)
1. Ir a Clasificacion TARIC
2. Escribir: "auriculares bluetooth inalambricos"
3. La IA devuelve el codigo TARIC con explicacion

### Parte 6: Paises Bajos (1 min - mencion)
1. Click en pastilla NL del dashboard
2. Mostrar que el sistema soporta DECO/DMS holandeses
3. Mencionar: "Cuando abrais en NL, solo teneis que activar el modulo"

## Datos del CSV de ejemplo

- 27 envios totales
- 25 envios H7 (valor < 150 EUR) - fundas, camisetas, auriculares, juguetes, cosmeticos...
- 2 envios H1 (valor > 150 EUR) - discos duros SSD, semiconductores
- Origenes: China (20), Japon (2), Corea (2), Tailandia (1), Turquia (1), India (1)
- Destinos: Madrid (9), Barcelona (8), Valencia (3), Sevilla (3), otros (4)
- Valor medio H7: ~24 EUR
- Peso total: ~23 kg

## Preparacion antes de la demo

- [ ] Verificar login de AIRGO funciona
- [ ] Subir el CSV de prueba una vez para verificar que IA clasifica bien
- [ ] Tener backup del CSV en USB/email
- [ ] Preparar pantalla compartida
- [ ] Tener abierto el chat IA
