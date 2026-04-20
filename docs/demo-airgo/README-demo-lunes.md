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

### Parte 2: Cumplimiento normativa 9 marzo 2026 - N337 (5 min) - CLAVE PARA LA VENTA

**Contexto para explicar al cliente**: "Desde el 9 de marzo de 2026, AEAT cerro las DSDT en recintos aereos. Ahora es OBLIGATORIO referenciar el deposito temporal G4 con documento previo N337 en todas las declaraciones H7. LUCI ya lo implementa automaticamente."

1. En el listado H7, mostrar el **banner EU 2026/382** arriba (expandir detalles)
2. Click en una de las H7 recien creadas del manifiesto
3. Bajar a la seccion **"Cumplimiento Normativo"** (fondo azul):
   - ✅ **Documento previo N337** - Con tipo y referencia G4 auto-generada
   - ✅ **Referencia G4 deposito temporal** - Codigo G4-XXXX
   - ✅ **Garantia aduanera (GRN)** - 26ESAGL2800000054
   - ⏳ **Derecho fijo 3 EUR/articulo** - "Entra en vigor 1 julio 2026"
4. Mostrar el **XML preview** (fondo negro): el fragmento `<C44Tipo>N337</C44Tipo>` resaltado en amarillo
5. **Frase clave**: "Cada H7 generada desde manifiesto ya incluye automaticamente el N337. No necesitais hacer nada manual."

**Si preguntan por julio 2026**: "El sistema ya esta preparado. Cuando entre en vigor el Reglamento 2026/382, LUCI aplicara automaticamente el derecho fijo de 3 EUR por articulo. Solo hay que activar un flag."

### Parte 2b: Envio H7 a AEAT PRE (3 min)
1. Seleccionar una H7 del listado (preferir PKG-N337-001 que ya esta released)
2. Mostrar MRN: 26ES33654921627399H7, canal verde
3. O seleccionar una H7 en draft → Click "Enviar a AEAT" → MRN + canal
4. Ir a **Circuitos** → mostrar la H7 con canal verde en el dashboard

### Parte 2c: N337 en H7 individual (1 min)
1. Click "+ Nueva H7" (no desde manifiesto)
2. Mostrar el aviso inline EU 2026/382
3. Mostrar la seccion **"Documento Previo G4 (N337)"** con selector tipo + campo referencia
4. **Frase**: "Tanto en manifiesto como en H7 individual, el N337 esta siempre presente"

### Parte 3: Manifiesto con normativa N337 en vivo (5 min) - OPCIONAL SI HAY TIEMPO

Si el cliente quiere verlo desde cero:
1. Click "Importar Manifiesto"
2. Subir `manifiesto_prueba_n337.csv` (5 envios, todo < 150 EUR)
3. Clasificar con IA → 5/5 H7
4. "Crear declaraciones H7"
5. Ver que TODAS tienen N337 automatico en el detalle
6. Enviar una a AEAT → MRN + canal verde

CSV de prueba N337: `docs/demo-airgo/manifiesto_prueba_n337.csv`

### Parte 4: H1 para envios >150 EUR (2 min)
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

- [ ] Verificar login AIRGO: bvillanueva@airgoexpress.com / AirgoDemo2026
- [ ] Verificar que las 4 H7 con N337 aparecen en el listado (PKG-N337-001 a 004)
- [ ] Click en PKG-N337-001 → verificar seccion "Cumplimiento Normativo" visible
- [ ] Tener ambos CSV listos: `manifiesto_ejemplo_airgo.csv` (27) + `manifiesto_prueba_n337.csv` (5)
- [ ] Preparar pantalla compartida
- [ ] Tener abierto el chat IA
- [ ] Si necesitas datos frescos: subir manifiesto_prueba_n337.csv y crear batch

## Argumentos de venta clave

1. **"LUCI es el UNICO sistema en España que ya cumple con la normativa del 9 de marzo"**
   - N337 automatico en cada H7
   - Referencia G4 auto-generada
   - XML compliant visible en detalle

2. **"Estamos preparados para julio 2026 (derecho fijo 3 EUR)"**
   - El tributo A00 se activara automaticamente
   - No necesitais cambiar nada en vuestro flujo

3. **"Todo automatico desde manifiesto CSV"**
   - Subis el CSV → IA clasifica → H7 con N337 → envio AEAT → MRN en segundos

4. **"Multi-pais: cuando abrais en NL, solo activais el modulo"**
   - DECO/DMS holandeses ya implementados
