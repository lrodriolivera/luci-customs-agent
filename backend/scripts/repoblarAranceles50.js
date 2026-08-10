#!/usr/bin/env node
/**
 * Repuebla desde el TARIC oficial los aranceles del catalogo que estaban al 50%
 * sin trazabilidad.
 *
 * QUE ESTABA MAL
 * --------------
 * 426 codigos (capitulos 14, 15, 22 y 23) tenian `duties.thirdCountry: 50` sin
 * ningun `source`. Contrastado contra el TARIC oficial, ese 50% NO era relleno
 * arbitrario ni el arancel general: es el derecho punitivo del Reg. (UE)
 * 2024/1392 aplicable solo a mercancia exportada desde Rusia o Bielorrusia. En
 * TARIC es una rama condicionada al certificado Y155; la otra rama de la misma
 * medida lleva el arancel de terceros paises (p.ej. aceite de soja 1507109000:
 * 6,40% general frente al 50% sancionado).
 *
 * Efecto en produccion: cualquier importacion de esos codigos desde un origen no
 * sancionado se liquidaba al 50%, y para el vino (2204210600, cuyo derecho real
 * es 32 EUR/hl especifico, sin componente ad valorem) se sumaba ademas un
 * porcentaje que la fuente no da.
 *
 * QUE HACE ESTE SCRIPT
 * --------------------
 * Aplica el volcado producido por el cliente del TARIC oficial:
 *   - `duties.thirdCountry`             <- arancel general (rama sin Y155)
 *   - `duties.specific`                 <- derecho especifico si la medida lo da
 *   - `duties.sancionRusiaBielorrusia`  <- el 50%, donde le corresponde
 *   - `duties.origen`                   <- fuente, fecha, metodo y texto literal
 *
 * Cuando el codigo abre varios codigos adicionales con tipos DISTINTOS no existe
 * "el" arancel de ese codigo (22042111 son dos codigos declarables, a 13,10 y a
 * 15,40 EUR/hl). En ese caso no se toca el codigo consultado y se aplica cada
 * tipo al codigo de 10 digitos que le corresponde, si esta en el catalogo.
 *
 * Los codigos que la fuente no resuelve a un tipo explicito (los codigos padre
 * acabados en ceros, que no son declarables y no tienen medidas propias) se
 * DEJAN INTACTOS y se listan al final. No se estiman: un arancel inventado es
 * justamente el bug que este script viene a corregir.
 *
 * Uso:
 *   node scripts/repoblarAranceles50.js --volcado=/ruta/taric-oficial.json [--aplicar]
 *
 * Sin `--aplicar` es una simulacion: informa de los cambios sin escribir nada.
 */
const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config();

const TaricCode = require('../src/models/TaricCode');

const args = process.argv.slice(2);
const rutaVolcado = (args.find((a) => a.startsWith('--volcado=')) || '').split('=')[1];
const aplicar = args.includes('--aplicar');

async function main() {
  if (!rutaVolcado || !fs.existsSync(rutaVolcado)) {
    console.error('Falta --volcado=<ruta al JSON del TARIC oficial>');
    process.exit(1);
  }

  const volcado = JSON.parse(fs.readFileSync(rutaVolcado, 'utf8'));
  console.log(`Volcado: ${volcado.length} codigos consultados`);
  console.log(aplicar ? 'MODO: aplicar cambios' : 'MODO: simulacion (usa --aplicar para escribir)');

  await mongoose.connect(process.env.MONGODB_URI);

  const cambios = [];
  const sinResolver = [];
  const noEncontrados = [];
  const yaEscritos = new Set();

  /**
   * Escribe el arancel de la fuente en un codigo del catalogo.
   * Devuelve el detalle del cambio, o null si el codigo no esta en el catalogo.
   */
  async function aplicarA(code, arancel, sancion, trazas, viaDe) {
    const doc = await TaricCode.findOne({ code });
    if (!doc) {
      noEncontrados.push(code);
      return null;
    }

    // El mismo codigo de 10 digitos aparece como variante de varios padres
    // (1507101000 lo devuelven 1507000000 y 1507100000). Escribirlo dos veces no
    // rompe nada, pero contarlo dos veces daria un recuento inflado.
    if (yaEscritos.has(code)) return null;
    yaEscritos.add(code);

    const antes = {
      thirdCountry: doc.duties?.thirdCountry,
      specific: doc.duties?.specific?.amount
        ? { amount: doc.duties.specific.amount, unit: doc.duties.specific.unit }
        : null
    };

    const nuevoAdValorem = arancel.adValorem;
    const nuevoEspecifico = arancel.specific || null;

    // Un derecho puramente especifico no lleva componente ad valorem: dejarlo en
    // el 50% anterior seria mantener el bug a medias.
    doc.duties.thirdCountry = typeof nuevoAdValorem === 'number' ? nuevoAdValorem : 0;

    if (nuevoEspecifico) {
      doc.duties.specific = { amount: nuevoEspecifico.amount, unit: nuevoEspecifico.unit };
    }

    if (sancion) {
      doc.duties.sancionRusiaBielorrusia = {
        adValorem: sancion.adValorem,
        certificado: sancion.certificado
      };
    }

    doc.duties.origen = {
      fuente: 'taric_oficial',
      consultadoEl: new Date(),
      evidencia: (trazas.evidencia || '').slice(0, 500),
      metodo: trazas.metodo,
      rotulo: trazas.rotulo || null,
      soloDestinoFinal: trazas.soloDestinoFinal || false
    };
    doc.lastUpdated = new Date();

    const cambio = {
      code,
      viaDe: viaDe || null,
      antes,
      despues: {
        thirdCountry: doc.duties.thirdCountry,
        specific: nuevoEspecifico,
        sancion: sancion?.adValorem ?? null,
        soloDestinoFinal: trazas.soloDestinoFinal || false
      }
    };
    cambios.push(cambio);

    if (aplicar) await doc.save();
    return cambio;
  }

  // Los codigos consultados van primero: su propia consulta es la fuente mas
  // directa para ese codigo, y asi una variante heredada de un padre no le pisa
  // el dato (aunque se comprobo que ninguna discrepa).
  const ordenados = [
    ...volcado.filter((i) => i.arancelOficial),
    ...volcado.filter((i) => !i.arancelOficial)
  ];

  for (const item of ordenados) {
    if (item.arancelOficial) {
      await aplicarA(
        item.code, item.arancelOficial, item.sancionRuBy,
        {
          evidencia: item.evidencia,
          metodo: item.motivo,
          rotulo: item.rotulo,
          soloDestinoFinal: item.soloDestinoFinal
        },
        null
      );
      continue;
    }

    // El codigo consultado no tiene un unico derecho, pero sus codigos
    // adicionales si: se aplica a cada uno el suyo y el padre queda intacto.
    if (item.variantes) {
      for (const [codigoVariante, v] of Object.entries(item.variantes)) {
        await aplicarA(
          codigoVariante, v.arancel, v.sancion,
          {
            evidencia: v.evidencia || item.evidencia,
            metodo: 'condiciones_de_medida_por_codigo_adicional',
            rotulo: v.rotulo,
            soloDestinoFinal: v.soloDestinoFinal
          },
          item.code
        );
      }
      sinResolver.push({
        code: item.code,
        motivo: `${item.motivo} (aplicado a ${Object.keys(item.variantes).length} codigos adicionales)`
      });
      continue;
    }

    sinResolver.push({ code: item.code, motivo: item.motivo });
  }

  console.log('\n=== RESULTADO ===');
  console.log(`Aranceles corregidos: ${cambios.length}`);
  console.log(`Sin tipo explicito en la fuente (INTACTOS): ${sinResolver.length}`);
  console.log(`No presentes en el catalogo local: ${noEncontrados.length}`);

  console.log(`  (de ellos, ${cambios.filter((c) => c.viaDe).length} por codigo adicional del padre)`);

  const destinoFinal = cambios.filter((c) => c.despues.soloDestinoFinal);
  console.log(`  (de ellos, ${destinoFinal.length} con tipo de destino final, marcado en duties.origen)`);

  console.log('\n--- primeros 20 cambios ---');
  cambios.slice(0, 20).forEach((c) => {
    const esp = c.despues.specific ? ` + ${c.despues.specific.amount} ${c.despues.specific.unit}` : '';
    console.log(`  ${c.code}: ${c.antes.thirdCountry}% -> ${c.despues.thirdCountry}%${esp}` +
      (c.despues.sancion !== null ? `  [sancion RU/BY ${c.despues.sancion}%]` : '') +
      (c.despues.soloDestinoFinal ? '  [solo destino final N990]' : '') +
      (c.viaDe ? `  (via ${c.viaDe})` : ''));
  });

  if (sinResolver.length) {
    console.log('\n--- sin resolver (se dejan como estaban) ---');
    sinResolver.slice(0, 30).forEach((s) => console.log(`  ${s.code} (${s.motivo})`));
    if (sinResolver.length > 30) console.log(`  ... y ${sinResolver.length - 30} mas`);
  }

  const distintos = [...new Set(cambios.map((c) => c.despues.thirdCountry))].sort((a, b) => a - b);
  console.log('\ntipos resultantes:', distintos.join('%, ') + '%');

  if (!aplicar) console.log('\nNo se ha escrito nada. Repite con --aplicar.');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
