import React from 'react'
import { Link } from 'react-router-dom'

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/landing" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-luci rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">L</span>
            </div>
            <span className="font-bold text-gray-900">LUCI</span>
          </Link>
          <Link to="/landing" className="text-sm text-luci hover:text-luci-dark">Volver al inicio</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terminos y Condiciones de Uso</h1>
        <p className="text-sm text-gray-500 mb-8">Ultima actualizacion: 12 de febrero de 2026</p>

        <div className="prose prose-gray max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">1. Identificacion del Prestador</h2>
            <p className="text-gray-700">
              El servicio LUCI es prestado por <strong>STRIX AI SL</strong>, con NIF B22477020, EORI ESB22477020,
              con domicilio social en Espana. Email de contacto: <strong>soporte@strixai.es</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">2. Objeto del Servicio</h2>
            <p className="text-gray-700">
              LUCI es una plataforma de gestion aduanera asistida por inteligencia artificial que permite:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-1">
              <li>Clasificacion arancelaria de mercancias con IA</li>
              <li>Calculo de aranceles, IVA e impuestos especiales</li>
              <li>Generacion y envio de declaraciones aduaneras a la AEAT</li>
              <li>Gestion de expedientes de importacion y exportacion</li>
              <li>Portal de clientes para seguimiento de operaciones</li>
              <li>Generacion de documentos PDF oficiales (DUA, AES, ENS, etc.)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">3. Registro y Cuenta</h2>
            <p className="text-gray-700">
              Para acceder al servicio, el usuario debe registrarse proporcionando datos veridicos.
              El usuario es responsable de mantener la confidencialidad de sus credenciales de acceso
              y de todas las actividades realizadas desde su cuenta. Debe notificar cualquier uso no
              autorizado a soporte@strixai.es de forma inmediata.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">4. Planes y Precios</h2>
            <p className="text-gray-700">LUCI ofrece los siguientes planes de suscripcion:</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-1">
              <li><strong>Starter (gratuito):</strong> funcionalidades basicas con limites de uso</li>
              <li><strong>Professional (149 EUR/mes):</strong> hasta 50 declaraciones/mes, 5 usuarios</li>
              <li><strong>Business (349 EUR/mes):</strong> hasta 200 declaraciones/mes, 15 usuarios, API publica</li>
              <li><strong>Enterprise (desde 799 EUR/mes):</strong> uso ilimitado, soporte dedicado</li>
            </ul>
            <p className="text-gray-700 mt-2">
              Los precios no incluyen IVA (21%). STRIX AI se reserva el derecho de modificar los precios
              con un preaviso minimo de 30 dias. Los pagos se gestionan a traves de Stripe.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">5. Facturacion y Pagos</h2>
            <p className="text-gray-700">
              La facturacion es mensual o anual segun el ciclo elegido. Los cargos se realizan automaticamente
              al inicio de cada periodo. En caso de impago, STRIX AI podra suspender el acceso tras 7 dias
              de aviso. Las devoluciones se gestionan conforme a la politica de Stripe.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">6. Uso de Inteligencia Artificial</h2>
            <p className="text-gray-700">
              LUCI utiliza modelos de IA de Anthropic (Claude) para asistir en clasificaciones arancelarias,
              analisis de documentos y consultas aduaneras. Los resultados de la IA son orientativos y
              deben ser revisados por un profesional cualificado antes de su uso en declaraciones oficiales.
              STRIX AI no garantiza la exactitud de las clasificaciones generadas por IA.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">7. Declaraciones Aduaneras</h2>
            <p className="text-gray-700">
              LUCI facilita la generacion y envio de declaraciones a la AEAT. El usuario es responsable
              de la veracidad de los datos declarados. STRIX AI actua como herramienta tecnologica y
              no sustituye la responsabilidad del declarante o representante aduanero autorizado.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">8. Propiedad Intelectual</h2>
            <p className="text-gray-700">
              Todo el software, diseno, marcas y contenido de LUCI son propiedad de STRIX AI SL.
              El usuario obtiene una licencia de uso limitada, no exclusiva y no transferible durante
              la vigencia de su suscripcion. Queda prohibida la reproduccion, distribucion o modificacion
              del software sin autorizacion expresa.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">9. Limitacion de Responsabilidad</h2>
            <p className="text-gray-700">
              STRIX AI no sera responsable de danos indirectos, perdida de beneficios, sanciones aduaneras
              o fiscales derivadas del uso del servicio. La responsabilidad maxima de STRIX AI se limita
              al importe pagado por el usuario en los ultimos 12 meses. STRIX AI no garantiza la
              disponibilidad ininterrumpida del servicio.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">10. Cancelacion</h2>
            <p className="text-gray-700">
              El usuario puede cancelar su suscripcion en cualquier momento desde el panel de facturacion
              o contactando a soporte@strixai.es. La cancelacion sera efectiva al final del periodo
              facturado. Los datos del usuario se conservaran durante 30 dias tras la cancelacion,
              salvo obligacion legal de conservacion mas prolongada.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">11. Modificaciones</h2>
            <p className="text-gray-700">
              STRIX AI se reserva el derecho de modificar estos terminos con un preaviso de 15 dias.
              El uso continuado del servicio tras la modificacion implica la aceptacion de los nuevos terminos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">12. Legislacion Aplicable</h2>
            <p className="text-gray-700">
              Estos terminos se rigen por la legislacion espanola. Para cualquier controversia,
              las partes se someten a los juzgados y tribunales de Zaragoza (Espana),
              con renuncia a cualquier otro fuero que pudiera corresponderles.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">13. Contacto</h2>
            <p className="text-gray-700">
              STRIX AI SL - NIF: B22477020<br />
              Email: soporte@strixai.es<br />
              Web: aduanas.strixai.es
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
