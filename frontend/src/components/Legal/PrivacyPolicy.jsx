import React from 'react'
import { Link } from 'react-router-dom'

export default function PrivacyPolicy() {
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Politica de Privacidad</h1>
        <p className="text-sm text-gray-500 mb-8">Ultima actualizacion: 12 de febrero de 2026</p>

        <div className="prose prose-gray max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">1. Responsable del Tratamiento</h2>
            <p className="text-gray-700">
              <strong>STRIX AI SL</strong> (en adelante, "STRIX AI"), con NIF B22477020 y domicilio social en Espana,
              es el responsable del tratamiento de los datos personales recogidos a traves de la plataforma LUCI
              (accesible en <strong>aduanas.strixai.es</strong>).
            </p>
            <p className="text-gray-700">Email de contacto: <strong>soporte@strixai.es</strong></p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">2. Datos que Recopilamos</h2>
            <p className="text-gray-700">Recopilamos los siguientes datos personales:</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-1">
              <li><strong>Datos de registro:</strong> nombre, email, nombre de empresa</li>
              <li><strong>Datos de uso:</strong> acciones realizadas en la plataforma, historial de clasificaciones, declaraciones generadas</li>
              <li><strong>Datos de facturacion:</strong> gestionados de forma segura por Stripe (no almacenamos datos de tarjeta)</li>
              <li><strong>Datos aduaneros:</strong> informacion de expedientes, mercancias, valores, documentos subidos por el usuario</li>
              <li><strong>Datos tecnicos:</strong> direccion IP, navegador, sistema operativo, logs de acceso</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">3. Finalidad del Tratamiento</h2>
            <p className="text-gray-700">Tratamos sus datos para:</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-1">
              <li>Gestionar su cuenta y proporcionar acceso a la plataforma LUCI</li>
              <li>Procesar declaraciones aduaneras y expedientes de comercio exterior</li>
              <li>Clasificar mercancias mediante inteligencia artificial</li>
              <li>Calcular aranceles, IVA e impuestos aplicables</li>
              <li>Enviar notificaciones transaccionales (confirmacion de cuenta, reset de contrasena, estado de declaraciones)</li>
              <li>Gestionar la facturacion y suscripciones</li>
              <li>Mejorar nuestros servicios y experiencia de usuario</li>
              <li>Cumplir con obligaciones legales y regulatorias</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">4. Base Legal</h2>
            <p className="text-gray-700">El tratamiento de sus datos se fundamenta en:</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-1">
              <li><strong>Ejecucion contractual</strong> (Art. 6.1.b RGPD): prestacion del servicio contratado</li>
              <li><strong>Obligacion legal</strong> (Art. 6.1.c RGPD): cumplimiento de normativa aduanera y fiscal</li>
              <li><strong>Interes legitimo</strong> (Art. 6.1.f RGPD): mejora de servicios y seguridad</li>
              <li><strong>Consentimiento</strong> (Art. 6.1.a RGPD): comunicaciones comerciales opcionales</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">5. Destinatarios de los Datos</h2>
            <p className="text-gray-700">Sus datos pueden ser compartidos con:</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-1">
              <li><strong>AEAT</strong> (Agencia Estatal de Administracion Tributaria): para el envio de declaraciones aduaneras, conforme a la normativa vigente</li>
              <li><strong>Stripe</strong>: procesamiento seguro de pagos (certificado PCI-DSS)</li>
              <li><strong>Amazon Web Services (AWS)</strong>: infraestructura y alojamiento en la UE (region eu-west-1, Irlanda)</li>
              <li><strong>Anthropic</strong>: procesamiento de consultas de IA (datos anonimizados)</li>
            </ul>
            <p className="text-gray-700 mt-2">No vendemos ni compartimos sus datos con terceros con fines comerciales.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">6. Transferencias Internacionales</h2>
            <p className="text-gray-700">
              Los datos se almacenan en servidores de AWS en la Union Europea (Irlanda).
              El procesamiento de IA por Anthropic puede implicar transferencias a EE.UU., protegidas por
              clausulas contractuales tipo aprobadas por la Comision Europea.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">7. Plazos de Conservacion</h2>
            <ul className="list-disc pl-6 text-gray-700 space-y-1">
              <li><strong>Datos de cuenta:</strong> mientras la cuenta este activa + 5 anos tras la baja</li>
              <li><strong>Datos aduaneros:</strong> 5 anos (obligacion legal, Art. 163 Codigo Aduanero de la Union)</li>
              <li><strong>Datos de facturacion:</strong> 5 anos (Ley General Tributaria)</li>
              <li><strong>Logs de acceso:</strong> 12 meses</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">8. Derechos del Interesado</h2>
            <p className="text-gray-700">Puede ejercer los siguientes derechos:</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-1">
              <li><strong>Acceso:</strong> solicitar copia de sus datos personales</li>
              <li><strong>Rectificacion:</strong> corregir datos inexactos</li>
              <li><strong>Supresion:</strong> solicitar la eliminacion de sus datos ("derecho al olvido")</li>
              <li><strong>Limitacion:</strong> restringir el tratamiento en determinadas circunstancias</li>
              <li><strong>Portabilidad:</strong> recibir sus datos en formato estructurado</li>
              <li><strong>Oposicion:</strong> oponerse al tratamiento basado en interes legitimo</li>
            </ul>
            <p className="text-gray-700 mt-2">
              Para ejercer estos derechos, contacte con <strong>soporte@strixai.es</strong>.
              Responderemos en un plazo maximo de 30 dias.
            </p>
            <p className="text-gray-700 mt-2">
              Puede presentar una reclamacion ante la <strong>Agencia Espanola de Proteccion de Datos (AEPD)</strong>: <a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer" className="text-luci hover:text-luci-dark">www.aepd.es</a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">9. Seguridad</h2>
            <p className="text-gray-700">
              Implementamos medidas tecnicas y organizativas para proteger sus datos:
              cifrado SSL/TLS, autenticacion JWT, hash de contrasenas con bcrypt,
              firewall y control de accesos, backups diarios cifrados y almacenados de forma segura.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">10. Cookies</h2>
            <p className="text-gray-700">
              Utilizamos cookies esenciales para el funcionamiento de la plataforma.
              Para mas informacion, consulte nuestra <Link to="/cookies" className="text-luci hover:text-luci-dark">Politica de Cookies</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">11. Contacto</h2>
            <p className="text-gray-700">
              STRIX AI SL<br />
              NIF: B22477020<br />
              Email: soporte@strixai.es<br />
              Web: aduanas.strixai.es
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
