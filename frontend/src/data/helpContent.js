const helpContent = {
  '/': {
    title: 'Dashboard',
    description: 'Panel principal con vista general del estado operativo aduanero.',
    tabs: {
      uso: {
        sections: [
          { title: 'Vista general', text: 'El dashboard muestra un resumen en tiempo real de tus operaciones: expedientes activos, plazos proximos, alertas y metricas clave.' },
          { title: 'Widgets', text: 'Cada tarjeta representa una metrica operativa. Puedes ver el estado de expedientes, circuitos asignados, documentos pendientes y mas.' }
        ],
        steps: [
          'Revisa las alertas prioritarias en la parte superior',
          'Consulta el resumen de expedientes activos por estado',
          'Verifica los plazos proximos a vencer',
          'Accede directamente a cualquier seccion desde las tarjetas'
        ]
      },
      normativa: {
        regulations: [
          { code: 'CAU Art. 5', title: 'Codigo Aduanero de la Union - Definiciones', description: 'Define los conceptos fundamentales del sistema aduanero europeo que se reflejan en el dashboard.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'RD 1073/2014', title: 'Reglamento de desarrollo de la normativa aduanera nacional', description: 'Adapta la normativa europea al contexto espanol y establece procedimientos operativos.', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2014-13225' }
        ]
      },
      luciIA: {
        features: [
          { name: 'Alertas inteligentes', description: 'LUCI analiza tus operaciones y genera alertas priorizadas segun urgencia y riesgo.' },
          { name: 'Resumen de estado', description: 'Genera automaticamente un resumen ejecutivo de la situacion operativa actual.' },
          { name: 'Prediccion de carga', description: 'Anticipa picos de trabajo basandose en patrones historicos y estacionalidad.' }
        ]
      }
    }
  },

  '/expeditions': {
    title: 'Expedientes',
    description: 'Gestion integral de expedientes aduaneros: creacion, seguimiento y resolucion.',
    tabs: {
      uso: {
        sections: [
          { title: 'Listado de expedientes', text: 'Visualiza todos los expedientes con filtros por estado, fecha, tipo de operacion y circuito asignado.' },
          { title: 'Detalle de expediente', text: 'Accede a la informacion completa: declaracion, documentos adjuntos, historial de acciones y comunicaciones.' },
          { title: 'Acciones', text: 'Desde cada expediente puedes generar requerimientos, asignar circuito, programar inspecciones o enviar comunicaciones.' }
        ],
        steps: [
          'Filtra expedientes por estado o criterio de busqueda',
          'Selecciona un expediente para ver su detalle completo',
          'Revisa los documentos adjuntos y su estado de validacion',
          'Ejecuta acciones segun el estado del expediente (requerir, inspeccionar, despachar)'
        ]
      },
      normativa: {
        regulations: [
          { code: 'CAU Art. 158-187', title: 'Despacho a libre practica', description: 'Regula el procedimiento de despacho aduanero, declaraciones y levante de mercancias.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'CAU Art. 15', title: 'Documentacion aduanera', description: 'Establece los requisitos documentales para las operaciones aduaneras.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'AD Art. 143-152', title: 'Acto Delegado - Declaraciones', description: 'Detalla los datos requeridos en cada tipo de declaracion aduanera.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32015R2446' }
        ]
      },
      luciIA: {
        features: [
          { name: 'Analisis de riesgo', description: 'LUCI evalua automaticamente el nivel de riesgo de cada expediente basandose en multiples factores.' },
          { name: 'Deteccion de inconsistencias', description: 'Identifica discrepancias entre documentos, valores declarados y datos historicos.' },
          { name: 'Sugerencia de documentos', description: 'Recomienda documentos adicionales necesarios segun el tipo de operacion y mercancia.' }
        ]
      }
    }
  },

  '/channels': {
    title: 'Circuitos',
    description: 'Gestion de circuitos aduaneros (verde, naranja, rojo) asignados a las declaraciones.',
    tabs: {
      uso: {
        sections: [
          { title: 'Asignacion de circuitos', text: 'Visualiza las declaraciones y su circuito asignado. Los circuitos determinan el nivel de control aplicable.' },
          { title: 'Tipos de circuito', text: 'Verde: levante automatico. Naranja: control documental. Rojo: reconocimiento fisico de la mercancia.' }
        ],
        steps: [
          'Consulta las declaraciones pendientes de asignacion de circuito',
          'Revisa la justificacion del circuito asignado',
          'Modifica el circuito si existen motivos fundamentados',
          'Registra las actuaciones realizadas en cada circuito'
        ]
      },
      normativa: {
        regulations: [
          { code: 'CAU Art. 188-193', title: 'Control aduanero y levante', description: 'Establece los tipos de control aplicables y los criterios para la seleccion de circuito.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'CAU Art. 46', title: 'Gestion de riesgos', description: 'Marco para el analisis de riesgos que determina la asignacion de circuitos.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' }
        ]
      },
      luciIA: {
        features: [
          { name: 'Prediccion de canal', description: 'LUCI predice el circuito probable antes de la asignacion oficial basandose en el perfil de riesgo.' },
          { name: 'Reevaluacion automatica', description: 'Sugiere cambios de circuito cuando se detectan nuevos factores de riesgo o informacion relevante.' },
          { name: 'Analisis de patrones', description: 'Identifica patrones en las asignaciones de circuito para optimizar la seleccion.' }
        ]
      }
    }
  },

  '/requirements': {
    title: 'Requerimientos',
    description: 'Gestion de requerimientos documentales y de informacion a los operadores.',
    tabs: {
      uso: {
        sections: [
          { title: 'Requerimientos activos', text: 'Lista de requerimientos emitidos pendientes de respuesta, con plazos y estado de cumplimiento.' },
          { title: 'Emision de requerimientos', text: 'Crea nuevos requerimientos especificando la documentacion o informacion requerida al operador.' }
        ],
        steps: [
          'Selecciona el expediente para el que necesitas informacion adicional',
          'Especifica los documentos o datos requeridos',
          'Establece el plazo de respuesta segun normativa',
          'Envia el requerimiento y monitoriza su cumplimiento'
        ]
      },
      normativa: {
        regulations: [
          { code: 'CAU Art. 188', title: 'Control de declaraciones', description: 'Facultad de la aduana para solicitar documentos adicionales durante el despacho.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'LGT Art. 93', title: 'Ley General Tributaria - Obligaciones de informacion', description: 'Obligacion de los operadores de facilitar la informacion requerida por la administracion.', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2003-23186' },
          { code: 'Ley 39/2015 Art. 68', title: 'LPAC - Subsanacion de defectos', description: 'Procedimiento de subsanacion y plazos para aportar documentacion.', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2015-10565' }
        ]
      },
      luciIA: {
        features: [
          { name: 'Borrador de respuestas', description: 'LUCI genera borradores de respuesta a los requerimientos basandose en la documentacion disponible.' },
          { name: 'Argumentos legales', description: 'Sugiere fundamentacion normativa para los requerimientos emitidos.' },
          { name: 'Analisis de riesgo documental', description: 'Evalua la calidad y completitud de la documentacion aportada en respuesta.' }
        ]
      }
    }
  },

  '/deadlines': {
    title: 'Plazos',
    description: 'Control y seguimiento de plazos legales y operativos en curso.',
    tabs: {
      uso: {
        sections: [
          { title: 'Calendario de plazos', text: 'Vista temporal de todos los plazos activos: vencimientos de declaraciones, respuestas a requerimientos, depositos temporales, etc.' },
          { title: 'Alertas de vencimiento', text: 'Sistema de alertas configurables segun la proximidad del vencimiento.' }
        ],
        steps: [
          'Revisa los plazos proximos a vencer en el panel de alertas',
          'Filtra por tipo de plazo o expediente asociado',
          'Configura las alertas anticipadas segun tus necesidades',
          'Registra las actuaciones realizadas para cumplir cada plazo'
        ]
      },
      normativa: {
        regulations: [
          { code: 'CAU Art. 108', title: 'Deposito temporal', description: 'Plazo maximo de 90 dias para mercancias en deposito temporal.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'CAU Art. 172', title: 'Plazos de presentacion', description: 'Plazos para la presentacion de declaraciones aduaneras.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'Ley 39/2015 Art. 21', title: 'LPAC - Obligacion de resolver', description: 'Plazos maximos de resolucion de procedimientos administrativos.', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2015-10565' }
        ]
      },
      luciIA: {
        features: [
          { name: 'Alertas proactivas', description: 'LUCI anticipa vencimientos y envia alertas con tiempo suficiente para actuar.' },
          { name: 'Priorizacion inteligente', description: 'Ordena los plazos segun impacto y urgencia, destacando los mas criticos.' },
          { name: 'Calculo automatico', description: 'Calcula automaticamente fechas de vencimiento considerando dias habiles y festivos.' }
        ]
      }
    }
  },

  '/inspections': {
    title: 'Inspecciones',
    description: 'Planificacion y registro de inspecciones fisicas y documentales.',
    tabs: {
      uso: {
        sections: [
          { title: 'Programacion', text: 'Programa inspecciones fisicas para las mercancias asignadas a circuito rojo o naranja documental.' },
          { title: 'Registro de resultados', text: 'Documenta los hallazgos de cada inspeccion: conformidad, incidencias, muestras tomadas, etc.' }
        ],
        steps: [
          'Consulta las inspecciones programadas para hoy',
          'Accede al expediente asociado para revisar la documentacion previa',
          'Registra los resultados de la inspeccion con evidencias',
          'Genera el acta de inspeccion y decide sobre el levante'
        ]
      },
      normativa: {
        regulations: [
          { code: 'CAU Art. 188-193', title: 'Verificacion de declaraciones', description: 'Procedimientos de control y reconocimiento fisico de mercancias.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'RD 1073/2014', title: 'Reglamento aduanero nacional', description: 'Procedimientos especificos de inspeccion en el ambito nacional espanol.', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2014-13225' },
          { code: 'CAU Art. 189', title: 'Toma de muestras', description: 'Regulacion de la toma de muestras durante las inspecciones aduaneras.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' }
        ]
      },
      luciIA: {
        features: [
          { name: 'Prediccion de resultado', description: 'LUCI estima la probabilidad de incidencias basandose en el perfil de riesgo del operador y la mercancia.' },
          { name: 'Checklist inteligente', description: 'Genera listas de verificacion adaptadas al tipo de mercancia e inspeccion.' },
          { name: 'Comparacion historica', description: 'Compara con inspecciones anteriores del mismo operador o tipo de mercancia.' }
        ]
      }
    }
  },

  '/communications': {
    title: 'Comunicaciones',
    description: 'Gestion de notificaciones y comunicaciones oficiales con operadores.',
    tabs: {
      uso: {
        sections: [
          { title: 'Bandeja de comunicaciones', text: 'Centraliza todas las comunicaciones oficiales: notificaciones, requerimientos, resoluciones y acuses de recibo.' },
          { title: 'Plantillas', text: 'Utiliza plantillas predefinidas para los tipos de comunicacion mas frecuentes.' }
        ],
        steps: [
          'Selecciona el tipo de comunicacion a generar',
          'Completa los datos del destinatario y contenido',
          'Revisa y valida antes del envio',
          'Monitoriza la entrega y acuse de recibo'
        ]
      },
      normativa: {
        regulations: [
          { code: 'Ley 39/2015 Art. 40-44', title: 'LPAC - Notificaciones', description: 'Regulacion de las notificaciones administrativas: medios, plazos y efectos.', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2015-10565' },
          { code: 'Ley 39/2015 Art. 14', title: 'LPAC - Comunicacion electronica', description: 'Obligacion de relacion electronica con la administracion para determinados sujetos.', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2015-10565' }
        ]
      },
      luciIA: {
        features: [
          { name: 'Generacion inteligente', description: 'LUCI genera borradores de notificaciones adaptados al contexto del expediente.' },
          { name: 'Verificacion normativa', description: 'Valida que las comunicaciones cumplan con los requisitos formales establecidos por la LPAC.' },
          { name: 'Seguimiento automatico', description: 'Monitoriza automaticamente los acuses de recibo y vencimientos de notificaciones.' }
        ]
      }
    }
  },

  '/classification': {
    title: 'Clasificacion TARIC',
    description: 'Clasificacion arancelaria de mercancias segun la nomenclatura combinada y TARIC.',
    tabs: {
      uso: {
        sections: [
          { title: 'Buscador TARIC', text: 'Busca codigos arancelarios por descripcion de mercancia, partida o capitulo del arancel.' },
          { title: 'Clasificacion asistida', text: 'Sistema guiado que aplica las Reglas Generales de Interpretacion (RGI) para determinar la clasificacion correcta.' },
          { title: 'Historial', text: 'Consulta clasificaciones anteriores y resoluciones de la DGT como referencia.' }
        ],
        steps: [
          'Describe la mercancia con el mayor detalle posible',
          'Revisa las sugerencias de clasificacion propuestas',
          'Aplica las RGI para confirmar la partida arancelaria',
          'Verifica las medidas TARIC asociadas al codigo seleccionado'
        ]
      },
      normativa: {
        regulations: [
          { code: 'CAU Art. 56-57', title: 'Clasificacion arancelaria', description: 'Base legal para la clasificacion de mercancias en la nomenclatura combinada.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'RGI 1-6', title: 'Reglas Generales de Interpretacion', description: 'Las 6 reglas fundamentales que rigen la clasificacion arancelaria de mercancias.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32019R1776' },
          { code: 'Reg. 2658/87', title: 'Nomenclatura Combinada', description: 'Reglamento base de la nomenclatura arancelaria y estadistica de la UE.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:31987R2658' }
        ]
      },
      luciIA: {
        features: [
          { name: 'Clasificacion IA', description: 'LUCI sugiere codigos TARIC basandose en la descripcion de la mercancia usando procesamiento de lenguaje natural.' },
          { name: 'Validacion cruzada', description: 'Compara la clasificacion propuesta con resoluciones previas y jurisprudencia del TJUE.' },
          { name: 'Analisis completo', description: 'Muestra automaticamente las medidas arancelarias, restricciones y requisitos asociados al codigo TARIC.' }
        ]
      }
    }
  },

  '/regulations': {
    title: 'Normativa',
    description: 'Consulta y busqueda de normativa aduanera: CAU, reglamentos UE, legislacion nacional.',
    tabs: {
      uso: {
        sections: [
          { title: 'Base normativa', text: 'Acceso a la normativa aduanera vigente: Codigo Aduanero de la Union, Actos Delegados e Implementacion, legislacion nacional.' },
          { title: 'Buscador', text: 'Busqueda por articulo, tema o palabra clave en toda la base normativa.' }
        ],
        steps: [
          'Selecciona el cuerpo normativo a consultar',
          'Busca por articulo especifico o por tema',
          'Consulta las notas interpretativas asociadas',
          'Guarda las referencias mas utilizadas en favoritos'
        ]
      },
      normativa: {
        regulations: [
          { code: 'Reg. 952/2013', title: 'Codigo Aduanero de la Union (CAU)', description: 'Reglamento base que establece el codigo aduanero de la Union Europea.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'Reg. 2015/2446', title: 'Acto Delegado (AD)', description: 'Complementa el CAU con disposiciones detalladas sobre procedimientos aduaneros.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32015R2446' },
          { code: 'Reg. 2015/2447', title: 'Acto de Ejecucion (AE)', description: 'Establece normas uniformes de aplicacion del CAU.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32015R2447' },
          { code: 'RD 1073/2014', title: 'Reglamento aduanero nacional', description: 'Adaptacion de la normativa aduanera europea al ordenamiento juridico espanol.', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2014-13225' }
        ]
      },
      luciIA: {
        features: [
          { name: 'Busqueda inteligente', description: 'LUCI interpreta consultas en lenguaje natural y localiza los articulos relevantes.' },
          { name: 'Relaciones normativas', description: 'Muestra conexiones entre articulos relacionados del CAU, AD y AE.' },
          { name: 'Actualizaciones', description: 'Alerta sobre cambios normativos recientes que puedan afectar tus operaciones.' }
        ]
      }
    }
  },

  '/declarations': {
    title: 'Declaraciones H1/AES',
    description: 'Generacion y gestion de declaraciones aduaneras de importacion (H1) y exportacion (AES).',
    tabs: {
      uso: {
        sections: [
          { title: 'Declaraciones de importacion (H1)', text: 'Genera declaraciones H1 con todos los datos requeridos: casillas DUA, documentos de acompanamiento, valores en aduana.' },
          { title: 'Declaraciones de exportacion (AES)', text: 'Crea declaraciones de exportacion conforme al sistema AES con datos del exportador, mercancia y destino.' },
          { title: 'Estado y seguimiento', text: 'Monitoriza el estado de cada declaracion: aceptada, en control, levantada, etc.' }
        ],
        steps: [
          'Selecciona el tipo de declaracion (H1 importacion o AES exportacion)',
          'Completa los datos obligatorios de la declaracion',
          'Adjunta los documentos de acompanamiento requeridos',
          'Valida la declaracion antes del envio',
          'Monitoriza el circuito y estado hasta el levante'
        ]
      },
      normativa: {
        regulations: [
          { code: 'CAU Art. 158-187', title: 'Declaraciones aduaneras', description: 'Regulacion completa de las declaraciones aduaneras: tipos, contenido, presentacion y admision.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'AD Art. 143', title: 'Datos de la declaracion', description: 'Especificacion detallada de los datos requeridos en cada tipo de declaracion.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32015R2446' },
          { code: 'CAU Art. 70-74', title: 'Valor en aduana', description: 'Metodos de determinacion del valor en aduana de las mercancias importadas.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' }
        ]
      },
      luciIA: {
        features: [
          { name: 'Generacion IA', description: 'LUCI pre-rellena declaraciones a partir de documentos comerciales (facturas, BL, packing list).' },
          { name: 'Validacion automatica', description: 'Detecta errores y campos incompletos antes del envio de la declaracion.' },
          { name: 'Deteccion de errores', description: 'Identifica inconsistencias entre los datos declarados y la documentacion adjunta.' },
          { name: 'Prediccion de canal', description: 'Estima el circuito probable que se asignara a la declaracion.' }
        ]
      }
    }
  },

  '/h7': {
    title: 'H7 E-commerce',
    description: 'Declaraciones simplificadas H7 para envios de comercio electronico de bajo valor.',
    tabs: {
      uso: {
        sections: [
          { title: 'Declaraciones H7', text: 'Gestion masiva de declaraciones simplificadas para envios e-commerce con valor inferior a 150 EUR.' },
          { title: 'Procesamiento por lotes', text: 'Importa y procesa multiples declaraciones H7 simultaneamente desde archivos CSV o integraciones API.' }
        ],
        steps: [
          'Importa los datos de envios desde tu plataforma e-commerce',
          'Verifica la elegibilidad de cada envio para declaracion H7',
          'Genera las declaraciones simplificadas en lote',
          'Monitoriza el estado de procesamiento y resuelve incidencias'
        ]
      },
      normativa: {
        regulations: [
          { code: 'CAU Art. 143a', title: 'Declaracion simplificada e-commerce', description: 'Base legal para las declaraciones simplificadas de envios de bajo valor.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'Reg. 2019/1143', title: 'Reglamento IVA e-commerce', description: 'Regimen especial de IVA para ventas a distancia y envios de bajo valor.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32019R1143' },
          { code: 'Dir. 2017/2455', title: 'Paquete IVA e-commerce', description: 'Directiva sobre obligaciones IVA para las prestaciones de servicios y ventas a distancia.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32017L2455' }
        ]
      },
      luciIA: {
        features: [
          { name: 'Verificacion de elegibilidad', description: 'LUCI valida automaticamente si cada envio cumple los criterios para declaracion H7.' },
          { name: 'Generacion automatica', description: 'Crea declaraciones H7 masivamente a partir de datos de plataformas e-commerce.' },
          { name: 'Deteccion de fraude', description: 'Identifica patrones sospechosos de infravalorados o splitting en envios e-commerce.' }
        ]
      }
    }
  },

  '/ens': {
    title: 'ENS/ICS2',
    description: 'Declaraciones sumarias de entrada (ENS) bajo el sistema ICS2.',
    tabs: {
      uso: {
        sections: [
          { title: 'ENS - Entry Summary Declaration', text: 'Gestion de declaraciones sumarias de entrada previas a la llegada de mercancias al territorio aduanero de la UE.' },
          { title: 'ICS2', text: 'Integracion con el sistema Import Control System 2 para la comunicacion de datos de seguridad.' }
        ],
        steps: [
          'Recibe los datos de la declaracion ENS del transportista',
          'Valida la completitud de los datos de seguridad',
          'Envia la ENS al sistema ICS2',
          'Monitoriza la respuesta del analisis de riesgo y notificaciones'
        ]
      },
      normativa: {
        regulations: [
          { code: 'CAU Art. 127-130', title: 'Declaracion sumaria de entrada', description: 'Obligacion de presentar ENS antes de la introduccion de mercancias en el territorio aduanero.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'Reg. 2019/1010', title: 'ICS2 - Reglamento de ejecucion', description: 'Establece el sistema ICS2 y sus requisitos tecnicos y de datos.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32019R1010' },
          { code: 'CAU Art. 46-47', title: 'Analisis de riesgo pre-llegada', description: 'Marco de analisis de riesgos aplicable a las ENS antes de la llegada.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' }
        ]
      },
      luciIA: {
        features: [
          { name: 'Prediccion de rechazo', description: 'LUCI estima la probabilidad de que una ENS sea rechazada por datos incompletos o inconsistentes.' },
          { name: 'Sugerencia de correcciones', description: 'Propone correcciones automaticas para ENS con errores detectados.' },
          { name: 'Analisis de riesgo pre-llegada', description: 'Evalua el nivel de riesgo de las mercancias antes de su llegada al territorio.' }
        ]
      }
    }
  },

  '/queries': {
    title: 'Consultas ADDS',
    description: 'Consultas al sistema ADDS (Aduanas) y JDIT para verificacion y tramitacion.',
    tabs: {
      uso: {
        sections: [
          { title: 'Consultas ADDS', text: 'Realiza consultas al sistema ADDS de la AEAT para verificar datos de operadores, declaraciones y autorizaciones.' },
          { title: 'Integracion JDIT', text: 'Acceso al sistema JDIT para consultas especificas de tramitacion aduanera.' }
        ],
        steps: [
          'Selecciona el tipo de consulta (NIF, declaracion, autorizacion)',
          'Introduce los datos de busqueda',
          'Revisa los resultados obtenidos',
          'Exporta o vincula los resultados al expediente correspondiente'
        ]
      },
      normativa: {
        regulations: [
          { code: 'RD 1065/2007', title: 'Reglamento de gestion e inspeccion tributaria', description: 'Regula los procedimientos de consulta y acceso a la informacion tributaria.', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2007-15984' },
          { code: 'Ley 58/2003 Art. 95', title: 'LGT - Caracter reservado de datos tributarios', description: 'Establece la confidencialidad de los datos tributarios y sus excepciones.', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2003-23186' }
        ]
      },
      luciIA: {
        features: [
          { name: 'Consultas automaticas', description: 'LUCI realiza consultas automaticas a ADDS y JDIT segun el contexto del expediente.' },
          { name: 'Correlacion de datos', description: 'Cruza informacion de multiples fuentes para detectar inconsistencias.' },
          { name: 'Historial de consultas', description: 'Mantiene un registro completo de todas las consultas realizadas y sus resultados.' }
        ]
      }
    }
  },

  '/pue': {
    title: 'PUE SOIVRE',
    description: 'Punto Unico de Entrada - Gestion de controles SOIVRE para mercancias sujetas a inspeccion.',
    tabs: {
      uso: {
        sections: [
          { title: 'PUE SOIVRE', text: 'Gestion del Punto Unico de Entrada para mercancias que requieren control SOIVRE (Servicio Oficial de Inspeccion, Vigilancia y Regulacion de las Exportaciones).' },
          { title: 'Tipos de control', text: 'Controles documentales, de identidad y fisicos sobre productos alimentarios, industriales y de consumo.' }
        ],
        steps: [
          'Identifica si la mercancia esta sujeta a control SOIVRE',
          'Genera la solicitud de inspeccion PUE',
          'Coordina la inspeccion con el servicio SOIVRE',
          'Registra el resultado y vincula al despacho aduanero'
        ]
      },
      normativa: {
        regulations: [
          { code: 'RD 330/2008', title: 'Control de comercio exterior', description: 'Regula las actividades de inspeccion y control de productos en comercio exterior.', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2008-4680' },
          { code: 'Reg. 2019/1013', title: 'Control de importaciones alimentarias', description: 'Normas sobre controles oficiales de productos alimentarios importados.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32019R1013' },
          { code: 'Reg. 2017/625', title: 'Controles oficiales', description: 'Reglamento sobre controles oficiales para garantizar la seguridad alimentaria.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32017R0625' }
        ]
      },
      luciIA: {
        features: [
          { name: 'Determinacion de tipo', description: 'LUCI identifica automaticamente si la mercancia requiere control SOIVRE y de que tipo.' },
          { name: 'Analisis de mercancias', description: 'Evalua las caracteristicas de la mercancia para anticipar requisitos de inspeccion.' },
          { name: 'Prediccion de inspeccion', description: 'Estima la probabilidad de inspeccion fisica basandose en el tipo de producto y origen.' }
        ]
      }
    }
  },

  '/guarantees': {
    title: 'Garantias',
    description: 'Gestion de garantias aduaneras: globales, individuales, exenciones y liberaciones.',
    tabs: {
      uso: {
        sections: [
          { title: 'Tipos de garantia', text: 'Gestiona garantias globales (para multiples operaciones), individuales (por operacion) y solicitudes de exencion.' },
          { title: 'Calculo y seguimiento', text: 'Controla el saldo disponible de tus garantias, importes comprometidos y liberaciones.' }
        ],
        steps: [
          'Consulta el estado de tus garantias activas y saldos disponibles',
          'Vincula la garantia correspondiente a cada operacion',
          'Solicita liberacion cuando la deuda aduanera se extinga',
          'Renueva o amplia garantias antes de su agotamiento'
        ]
      },
      normativa: {
        regulations: [
          { code: 'CAU Art. 89-100', title: 'Garantias', description: 'Regulacion completa de las garantias aduaneras: constitucion, tipos, importes y liberacion.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'CAU Art. 95', title: 'Garantia global', description: 'Condiciones para constituir garantia global que cubra multiples operaciones.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'AD Art. 51-55', title: 'Acto Delegado - Garantias', description: 'Disposiciones detalladas sobre tipos y montos de garantias.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32015R2446' }
        ]
      },
      luciIA: {
        features: [
          { name: 'Analisis de necesidades', description: 'LUCI calcula la garantia optima segun el volumen y tipo de operaciones del operador.' },
          { name: 'Recomendacion de tipo', description: 'Sugiere el tipo de garantia mas eficiente (global, individual, exencion) segun el perfil.' },
          { name: 'Optimizacion', description: 'Identifica oportunidades para reducir el importe de garantia mediante exenciones o reducciones autorizadas.' }
        ]
      }
    }
  },

  '/oea': {
    title: 'OEA',
    description: 'Gestion del estatus de Operador Economico Autorizado.',
    tabs: {
      uso: {
        sections: [
          { title: 'Estatus OEA', text: 'Gestion del estatus OEA: solicitudes, seguimiento de autorizaciones, cumplimiento continuo y renovaciones.' },
          { title: 'Tipos OEA', text: 'OEA-C (simplificaciones aduaneras), OEA-S (proteccion y seguridad) y OEA combinado.' }
        ],
        steps: [
          'Evalua los requisitos para obtener el estatus OEA',
          'Prepara la solicitud con la documentacion requerida',
          'Monitoriza el progreso de la evaluacion',
          'Manten el cumplimiento continuo de los criterios OEA'
        ]
      },
      normativa: {
        regulations: [
          { code: 'CAU Art. 38-39', title: 'Operador Economico Autorizado', description: 'Requisitos y beneficios del estatus OEA en la Union Europea.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'AD Art. 24-30', title: 'Acto Delegado - Criterios OEA', description: 'Criterios detallados para la concesion y mantenimiento del estatus OEA.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32015R2446' },
          { code: 'AE Art. 26-31', title: 'Acto de Ejecucion - Procedimiento OEA', description: 'Procedimiento de solicitud, evaluacion y concesion del estatus OEA.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32015R2447' }
        ]
      },
      luciIA: {
        features: [
          { name: 'Evaluacion de cumplimiento', description: 'LUCI evalua el grado de cumplimiento de los criterios OEA del operador.' },
          { name: 'Gestion de renovaciones', description: 'Alerta sobre renovaciones pendientes y cambios en criterios de cumplimiento.' },
          { name: 'Checklist automatico', description: 'Genera automaticamente la lista de verificacion de requisitos OEA actualizada.' }
        ]
      }
    }
  },

  '/special-regimes': {
    title: 'Regimenes Especiales',
    description: 'Gestion de regimenes aduaneros especiales: deposito, perfeccionamiento, destino final, etc.',
    tabs: {
      uso: {
        sections: [
          { title: 'Tipos de regimenes', text: 'Deposito aduanero, perfeccionamiento activo y pasivo, importacion temporal, destino final y zonas francas.' },
          { title: 'Autorizaciones', text: 'Solicitud y gestion de autorizaciones para operar bajo regimenes especiales.' }
        ],
        steps: [
          'Determina el regimen especial aplicable a la operacion',
          'Verifica la autorizacion vigente o solicita una nueva',
          'Registra las operaciones bajo el regimen (entrada, transformacion, salida)',
          'Controla los plazos de liquidacion y las cuentas de existencias'
        ]
      },
      normativa: {
        regulations: [
          { code: 'CAU Art. 210-262', title: 'Regimenes especiales', description: 'Regulacion completa de todos los regimenes aduaneros especiales de la UE.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'CAU Art. 211', title: 'Autorizaciones de regimenes especiales', description: 'Requisitos para obtener autorizacion de regimenes especiales.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'CAU Art. 255-258', title: 'Perfeccionamiento activo', description: 'Condiciones del regimen de perfeccionamiento activo.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' }
        ]
      },
      luciIA: {
        features: [
          { name: 'Asesor de regimen', description: 'LUCI recomienda el regimen especial mas beneficioso segun las caracteristicas de la operacion.' },
          { name: 'Validacion de rendimientos', description: 'Verifica las tasas de rendimiento declaradas en perfeccionamiento activo y pasivo.' },
          { name: 'Control de existencias', description: 'Monitoriza automaticamente las cuentas de existencias y alerta sobre discrepancias.' }
        ]
      }
    }
  },

  '/transit': {
    title: 'Transitos NCTS',
    description: 'Gestion de operaciones de transito comunitario y comun bajo el sistema NCTS.',
    tabs: {
      uso: {
        sections: [
          { title: 'Transito NCTS', text: 'Creacion y seguimiento de operaciones de transito T1 (externo) y T2 (interno) a traves del New Computerised Transit System.' },
          { title: 'Seguimiento', text: 'Monitoriza el estado del transito: salida de aduana de partida, transito en curso, llegada a aduana de destino y ultimacion.' }
        ],
        steps: [
          'Crea una nueva operacion de transito con los datos de la mercancia y ruta',
          'Genera el MRN (Movement Reference Number)',
          'Monitoriza el transito en tiempo real',
          'Registra la llegada y ultimacion en aduana de destino'
        ]
      },
      normativa: {
        regulations: [
          { code: 'CAU Art. 226-236', title: 'Transito aduanero', description: 'Regulacion del transito externo e interno en la Union Europea.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'Convenio TIR', title: 'Transporte Internacional por Carretera', description: 'Convenio para el transporte internacional de mercancias bajo cuadernos TIR.', url: 'https://unece.org/tir-convention' },
          { code: 'Convenio de Transito Comun', title: 'CTC', description: 'Convenio que extiende el transito comunitario a paises EFTA y otros.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:21987A0813(01)' }
        ]
      },
      luciIA: {
        features: [
          { name: 'Auto-completado', description: 'LUCI pre-rellena datos de transito basandose en operaciones anteriores similares.' },
          { name: 'Validacion de ruta', description: 'Verifica la coherencia de la ruta declarada con las aduanas de paso.' },
          { name: 'Prediccion de incidencias', description: 'Anticipa posibles problemas en el transito basandose en patrones historicos.' }
        ]
      }
    }
  },

  '/calculator': {
    title: 'Calculadora',
    description: 'Calculo de derechos arancelarios, IVA importacion y otros gravamenes.',
    tabs: {
      uso: {
        sections: [
          { title: 'Calculadora arancelaria', text: 'Calcula los derechos de importacion, IVA, derechos antidumping y otros gravamenes aplicables a una mercancia.' },
          { title: 'Simulacion', text: 'Simula el coste total de importacion incluyendo todos los gravamenes y tasas aplicables.' }
        ],
        steps: [
          'Introduce el codigo TARIC de la mercancia',
          'Especifica el origen, valor en aduana y cantidad',
          'Revisa el desglose de derechos e impuestos',
          'Aplica preferencias arancelarias si corresponde'
        ]
      },
      normativa: {
        regulations: [
          { code: 'CAU Art. 56', title: 'Arancel Aduanero Comun', description: 'Base legal del Arancel Aduanero Comun de la UE y sus tipos de derechos.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'Arancel Comun UE', title: 'TARIC', description: 'Arancel Integrado de la UE con todos los derechos y medidas aplicables.', url: 'https://ec.europa.eu/taxation_customs/dds2/taric/taric_consultation.jsp?Lang=es' },
          { code: 'Ley 37/1992', title: 'Ley del IVA', description: 'Regulacion del IVA a la importacion en el sistema tributario espanol.', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1992-28740' }
        ]
      },
      luciIA: {
        features: [
          { name: 'Calculo multinivel', description: 'LUCI calcula automaticamente todos los niveles de gravamen: aranceles, antidumping, IVA, impuestos especiales.' },
          { name: 'Validacion de tasas', description: 'Verifica que los tipos arancelarios aplicados estan vigentes y son correctos.' },
          { name: 'Optimizacion de costes', description: 'Sugiere formas legales de optimizar el coste arancelario (preferencias, contingentes, regimenes).' }
        ]
      }
    }
  },

  '/rules-engine': {
    title: 'Motor de Reglas',
    description: 'Motor de evaluacion automatica de reglas aduaneras y de cumplimiento.',
    tabs: {
      uso: {
        sections: [
          { title: 'Reglas configurables', text: 'Define y gestiona reglas de negocio para automatizar decisiones aduaneras: validaciones, alertas y flujos de trabajo.' },
          { title: 'Evaluacion', text: 'El motor evalua automaticamente cada operacion contra el conjunto de reglas activas.' }
        ],
        steps: [
          'Configura las reglas de negocio segun tus necesidades operativas',
          'Define las condiciones y acciones de cada regla',
          'Activa las reglas y monitoriza su ejecucion',
          'Revisa los resultados y ajusta las reglas segun la experiencia'
        ]
      },
      normativa: {
        regulations: [
          { code: 'CAU Titulo II', title: 'Elementos para la aplicacion de derechos', description: 'Marco normativo que fundamenta las reglas de clasificacion, origen y valoracion.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'CAU Art. 46', title: 'Gestion de riesgos', description: 'Criterios de riesgo que pueden traducirse en reglas automatizadas.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' }
        ]
      },
      luciIA: {
        features: [
          { name: 'Evaluacion automatica', description: 'LUCI aplica las reglas configuradas automaticamente a cada nueva operacion.' },
          { name: 'Sugerencia de reglas', description: 'Propone nuevas reglas basandose en patrones detectados en las operaciones.' },
          { name: 'Analisis de efectividad', description: 'Mide el impacto de cada regla y sugiere optimizaciones.' }
        ]
      }
    }
  },

  '/preferences': {
    title: 'Preferencias',
    description: 'Gestion de preferencias arancelarias por acuerdos comerciales y origen.',
    tabs: {
      uso: {
        sections: [
          { title: 'Acuerdos comerciales', text: 'Consulta los acuerdos comerciales vigentes de la UE y las preferencias arancelarias disponibles.' },
          { title: 'Verificacion de origen', text: 'Verifica el cumplimiento de las reglas de origen para aplicar preferencias arancelarias.' }
        ],
        steps: [
          'Identifica el pais de origen de la mercancia',
          'Consulta los acuerdos comerciales aplicables',
          'Verifica el certificado de origen o declaracion en factura',
          'Aplica la preferencia arancelaria correspondiente'
        ]
      },
      normativa: {
        regulations: [
          { code: 'CAU Art. 56-65', title: 'Origen de las mercancias', description: 'Reglas de origen no preferencial y preferencial de la Union Europea.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'Protocolos de origen', title: 'Protocolos de los acuerdos', description: 'Protocolos especificos de reglas de origen en cada acuerdo comercial de la UE.', url: 'https://trade.ec.europa.eu/access-to-markets/es/content/acuerdos-comerciales-de-la-ue' },
          { code: 'Reg. 2015/2446 Art. 37-70', title: 'AD - Reglas de origen', description: 'Disposiciones detalladas sobre reglas de origen y documentos justificativos.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32015R2446' }
        ]
      },
      luciIA: {
        features: [
          { name: 'Calculo por acuerdo', description: 'LUCI calcula la preferencia arancelaria optima segun cada acuerdo comercial aplicable.' },
          { name: 'Verificacion de origen', description: 'Valida el cumplimiento de las reglas de origen especificas del acuerdo.' },
          { name: 'Comparativa de beneficios', description: 'Compara el ahorro arancelario entre diferentes acuerdos comerciales aplicables.' }
        ]
      }
    }
  },

  '/excise-duties': {
    title: 'Impuestos Especiales',
    description: 'Gestion de impuestos especiales sobre alcohol, tabaco, hidrocarburos y electricidad.',
    tabs: {
      uso: {
        sections: [
          { title: 'Tipos de impuestos especiales', text: 'Gestion de impuestos especiales de fabricacion: alcohol, bebidas derivadas, tabaco, hidrocarburos y electricidad.' },
          { title: 'Calculo y liquidacion', text: 'Calculo de los impuestos especiales aplicables y gestion de la liquidacion.' }
        ],
        steps: [
          'Identifica si la mercancia esta sujeta a impuestos especiales',
          'Determina la base imponible y el tipo impositivo aplicable',
          'Calcula el importe del impuesto especial',
          'Incluye el impuesto en la liquidacion aduanera'
        ]
      },
      normativa: {
        regulations: [
          { code: 'Ley 38/1992', title: 'Ley de Impuestos Especiales', description: 'Ley espanola que regula los impuestos especiales de fabricacion.', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1992-28741' },
          { code: 'Dir. 2020/262', title: 'Directiva general IIEE', description: 'Directiva europea sobre el regimen general de los impuestos especiales.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32020L0262' },
          { code: 'RD 1165/1995', title: 'Reglamento de Impuestos Especiales', description: 'Reglamento de desarrollo de la Ley de Impuestos Especiales.', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1995-17661' }
        ]
      },
      luciIA: {
        features: [
          { name: 'Calculo automatico', description: 'LUCI calcula automaticamente los impuestos especiales segun el tipo de producto y cantidad.' },
          { name: 'Deteccion de obligacion', description: 'Identifica automaticamente las mercancias sujetas a impuestos especiales.' },
          { name: 'Exenciones y reducciones', description: 'Verifica la aplicabilidad de exenciones o tipos reducidos segun el destino de la mercancia.' }
        ]
      }
    }
  },

  '/quotas': {
    title: 'Contingentes',
    description: 'Gestion de contingentes arancelarios y su disponibilidad.',
    tabs: {
      uso: {
        sections: [
          { title: 'Contingentes arancelarios', text: 'Consulta y gestion de contingentes arancelarios que permiten importar cantidades limitadas con derechos reducidos o nulos.' },
          { title: 'Disponibilidad', text: 'Verificacion en tiempo real del saldo disponible de cada contingente.' }
        ],
        steps: [
          'Identifica los contingentes aplicables a tu mercancia y origen',
          'Verifica la disponibilidad del contingente',
          'Solicita la aplicacion del contingente en la declaracion',
          'Monitoriza la adjudicacion y agotamiento del contingente'
        ]
      },
      normativa: {
        regulations: [
          { code: 'CAU Art. 56(4)', title: 'Contingentes arancelarios', description: 'Base legal para la aplicacion de contingentes arancelarios en la UE.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'Reg. base contingentes', title: 'Reglamentos de apertura', description: 'Reglamentos especificos que abren y gestionan cada contingente arancelario.', url: 'https://ec.europa.eu/taxation_customs/dds2/taric/quota_consultation.jsp?Lang=es' }
        ]
      },
      luciIA: {
        features: [
          { name: 'Verificacion de disponibilidad', description: 'LUCI consulta en tiempo real la disponibilidad de contingentes para tu mercancia.' },
          { name: 'Calculo de ahorro', description: 'Estima el ahorro arancelario por aplicacion del contingente frente al tipo normal.' },
          { name: 'Alerta de agotamiento', description: 'Notifica cuando un contingente esta proximo a agotarse para anticipar solicitudes.' }
        ]
      }
    }
  },

  '/integrations': {
    title: 'Integraciones',
    description: 'Estado y configuracion de integraciones con sistemas externos (AEAT, TARIC, etc.).',
    tabs: {
      uso: {
        sections: [
          { title: 'Sistemas integrados', text: 'Panel de estado de las integraciones con sistemas externos: AEAT, TARIC, VIES, SOIVRE y otros.' },
          { title: 'Configuracion', text: 'Configura y gestiona las credenciales y parametros de conexion de cada integracion.' }
        ],
        steps: [
          'Revisa el estado de conectividad de cada sistema externo',
          'Configura las credenciales de acceso necesarias',
          'Verifica la sincronizacion de datos',
          'Resuelve incidencias de conectividad'
        ]
      },
      normativa: {
        regulations: [
          { code: 'Normativa AEAT', title: 'Intercambio electronico con AEAT', description: 'Especificaciones tecnicas y normativa para el intercambio electronico de datos con la AEAT.', url: 'https://sede.agenciatributaria.gob.es/Sede/ayuda/disenos-registro.html' },
          { code: 'Reg. 2019/1010', title: 'Intercambio de datos UE', description: 'Requisitos de interoperabilidad entre sistemas aduaneros de la UE.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32019R1010' }
        ]
      },
      luciIA: {
        features: [
          { name: 'Estado de conexiones', description: 'LUCI monitoriza continuamente el estado de todas las integraciones y alerta ante caidas.' },
          { name: 'Diagnostico de errores', description: 'Analiza y sugiere soluciones para errores de conectividad con sistemas externos.' },
          { name: 'Sincronizacion inteligente', description: 'Optimiza los tiempos de sincronizacion segun la carga del sistema.' }
        ]
      }
    }
  },

  '/aeat/certificates': {
    title: 'Certificados AEAT',
    description: 'Gestion de certificados digitales para la comunicacion con la AEAT.',
    tabs: {
      uso: {
        sections: [
          { title: 'Certificados digitales', text: 'Gestion de los certificados digitales necesarios para la comunicacion electronica con la AEAT.' },
          { title: 'Renovacion', text: 'Control de vigencia y renovacion de certificados antes de su caducidad.' }
        ],
        steps: [
          'Revisa el estado y vigencia de tus certificados activos',
          'Instala nuevos certificados siguiendo el asistente',
          'Configura el certificado por defecto para cada tipo de operacion',
          'Renueva los certificados antes de su fecha de caducidad'
        ]
      },
      normativa: {
        regulations: [
          { code: 'RD 1065/2007', title: 'Reglamento de gestion tributaria', description: 'Regula el uso de certificados digitales en la relacion con la administracion tributaria.', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2007-15984' },
          { code: 'Ley 6/2020', title: 'Servicios electronicos de confianza', description: 'Regulacion de la firma electronica y servicios de confianza en Espana.', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2020-14046' }
        ]
      },
      luciIA: {
        features: [
          { name: 'Gestion de certificados', description: 'LUCI monitoriza la vigencia de los certificados y alerta antes de la caducidad.' },
          { name: 'Validacion automatica', description: 'Verifica la validez y configuracion correcta de cada certificado instalado.' },
          { name: 'Asistente de instalacion', description: 'Guia paso a paso para la instalacion y configuracion de nuevos certificados.' }
        ]
      }
    }
  },

  '/aeat/monitor': {
    title: 'Monitor AEAT',
    description: 'Monitorizacion en tiempo real del estado de los servicios de la AEAT.',
    tabs: {
      uso: {
        sections: [
          { title: 'Monitor de servicios', text: 'Panel de monitorizacion del estado de los servicios web de la AEAT: disponibilidad, tiempos de respuesta e incidencias.' },
          { title: 'Historial', text: 'Consulta el historial de disponibilidad y rendimiento de los servicios AEAT.' }
        ],
        steps: [
          'Consulta el estado actual de cada servicio AEAT',
          'Revisa los tiempos de respuesta y latencia',
          'Configura alertas para caidas de servicio',
          'Consulta el historial de incidencias'
        ]
      },
      normativa: {
        regulations: [
          { code: 'Disponibilidad AEAT', title: 'Compromiso de servicio', description: 'Niveles de servicio y disponibilidad de los sistemas electronicos de la AEAT.', url: 'https://sede.agenciatributaria.gob.es/' }
        ]
      },
      luciIA: {
        features: [
          { name: 'Monitorizacion continua', description: 'LUCI verifica el estado de los servicios AEAT cada 5 minutos y alerta ante anomalias.' },
          { name: 'Prediccion de ventanas', description: 'Estima los mejores horarios para operaciones basandose en patrones de disponibilidad.' },
          { name: 'Diagnostico automatico', description: 'Analiza las causas de errores de comunicacion con la AEAT y sugiere acciones.' }
        ]
      }
    }
  },

  '/analytics': {
    title: 'Analytics',
    description: 'Panel de analisis e inteligencia de negocio sobre operaciones aduaneras.',
    tabs: {
      uso: {
        sections: [
          { title: 'Dashboards analiticos', text: 'Visualizacion avanzada de metricas operativas: volumen de operaciones, tiempos de despacho, distribucion de circuitos, etc.' },
          { title: 'Informes', text: 'Generacion de informes personalizados con filtros por periodo, tipo de operacion, operador y mas.' }
        ],
        steps: [
          'Selecciona el periodo de analisis',
          'Elige las metricas y dimensiones a visualizar',
          'Aplica filtros segun tus necesidades de analisis',
          'Exporta los informes en el formato deseado'
        ]
      },
      normativa: {
        regulations: [
          { code: 'Normativa interna', title: 'Indicadores de gestion', description: 'Metricas e indicadores operativos definidos para la gestion aduanera.' }
        ]
      },
      luciIA: {
        features: [
          { name: 'Insights IA', description: 'LUCI genera automaticamente insights relevantes a partir del analisis de tus datos operativos.' },
          { name: 'Deteccion de anomalias', description: 'Identifica patrones anomalos en las operaciones que pueden indicar errores o fraude.' },
          { name: 'Prediccion de tendencias', description: 'Anticipa tendencias operativas basandose en datos historicos y factores externos.' }
        ]
      }
    }
  },

  '/settings': {
    title: 'Configuracion',
    description: 'Configuracion general del sistema LUCI Customs Agent.',
    tabs: {
      uso: {
        sections: [
          { title: 'Preferencias generales', text: 'Configura idioma, zona horaria, formato de fechas y otras preferencias del sistema.' },
          { title: 'Notificaciones', text: 'Gestiona las preferencias de notificaciones: email, push, alertas en pantalla.' },
          { title: 'Seguridad', text: 'Configuracion de seguridad: cambio de contrasena, autenticacion de dos factores.' }
        ],
        steps: [
          'Revisa y ajusta las preferencias generales del sistema',
          'Configura tus preferencias de notificaciones',
          'Verifica la configuracion de seguridad de tu cuenta',
          'Guarda los cambios realizados'
        ]
      },
      normativa: {
        regulations: [
          { code: 'RGPD', title: 'Proteccion de datos', description: 'Reglamento General de Proteccion de Datos aplicable a la configuracion de privacidad.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32016R0679' },
          { code: 'ENS', title: 'Esquema Nacional de Seguridad', description: 'Requisitos de seguridad para sistemas de la administracion publica.', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2022-7191' }
        ]
      },
      luciIA: {
        features: [
          { name: 'Configuracion personalizada', description: 'LUCI adapta su comportamiento segun tus preferencias configuradas.' },
          { name: 'Recomendaciones', description: 'Sugiere configuraciones optimas basandose en tu perfil de uso.' }
        ]
      }
    }
  },

  '/billing': {
    title: 'Facturacion',
    description: 'Gestion de facturacion y uso del servicio LUCI Customs Agent.',
    tabs: {
      uso: {
        sections: [
          { title: 'Plan y uso', text: 'Consulta tu plan actual, consumo de recursos y detalle de facturacion.' },
          { title: 'Facturas', text: 'Accede al historial de facturas y descarga los documentos fiscales.' }
        ],
        steps: [
          'Consulta tu plan activo y consumo del periodo',
          'Revisa el historial de facturas',
          'Descarga las facturas necesarias',
          'Gestiona los metodos de pago'
        ]
      },
      normativa: {
        regulations: [
          { code: 'RD 1619/2012', title: 'Reglamento de facturacion', description: 'Requisitos legales de facturacion aplicables en Espana.', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2012-14696' }
        ]
      },
      luciIA: {
        features: [
          { name: 'Resumen de uso', description: 'LUCI genera resumenes de tu consumo y te ayuda a optimizar el uso del servicio.' },
          { name: 'Alertas de consumo', description: 'Notifica cuando te acercas a los limites de tu plan.' }
        ]
      }
    }
  },

  '/admin': {
    title: 'Administracion',
    description: 'Panel de administracion para gestion de usuarios, roles y configuracion del sistema.',
    tabs: {
      uso: {
        sections: [
          { title: 'Gestion de usuarios', text: 'Administra los usuarios del sistema: alta, baja, asignacion de roles y permisos.' },
          { title: 'Roles y permisos', text: 'Define roles personalizados y asigna permisos granulares a cada perfil.' },
          { title: 'Auditoria', text: 'Consulta el registro de actividad del sistema para fines de auditoria y cumplimiento.' }
        ],
        steps: [
          'Gestiona los usuarios activos del sistema',
          'Configura los roles y permisos de cada usuario',
          'Revisa el registro de actividad y auditoria',
          'Administra la configuracion global del sistema'
        ]
      },
      normativa: {
        regulations: [
          { code: 'RGPD', title: 'Proteccion de datos', description: 'Reglamento General de Proteccion de Datos en la gestion de usuarios.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32016R0679' },
          { code: 'ENS', title: 'Esquema Nacional de Seguridad', description: 'Requisitos de seguridad en la administracion de accesos y permisos.', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2022-7191' }
        ]
      },
      luciIA: {
        features: [
          { name: 'Panel administrativo', description: 'LUCI proporciona herramientas de administracion centralizadas.' },
          { name: 'Deteccion de anomalias', description: 'Alerta sobre accesos o actividades inusuales en el sistema.' },
          { name: 'Informes de uso', description: 'Genera informes de actividad y uso del sistema por usuario y departamento.' }
        ]
      }
    }
  },

  '/ml-insights': {
    title: 'ML Insights',
    description: 'Panel avanzado de Machine Learning con predicciones, deteccion de fraude y clasificacion automatica.',
    tabs: {
      uso: {
        sections: [
          { title: 'Modelos predictivos', text: 'Visualiza las predicciones de los modelos de ML: probabilidad de inspeccion, riesgo de fraude, clasificacion sugerida.' },
          { title: 'Metricas de rendimiento', text: 'Monitoriza la precision y rendimiento de los modelos de ML en produccion.' }
        ],
        steps: [
          'Consulta las predicciones activas de los modelos ML',
          'Revisa las alertas de fraude generadas',
          'Verifica las sugerencias de clasificacion automatica',
          'Analiza las metricas de rendimiento de cada modelo'
        ]
      },
      normativa: {
        regulations: [
          { code: 'Reg. IA UE 2024/1689', title: 'Reglamento de Inteligencia Artificial', description: 'Marco regulatorio europeo para sistemas de inteligencia artificial.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32024R1689' },
          { code: 'RGPD Art. 22', title: 'Decisiones automatizadas', description: 'Derechos del interesado ante decisiones basadas unicamente en tratamiento automatizado.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32016R0679' }
        ]
      },
      luciIA: {
        features: [
          { name: 'Predicciones ML', description: 'Modelos de machine learning entrenados con datos aduaneros para predicciones precisas.' },
          { name: 'Deteccion de fraude', description: 'Algoritmos especializados en detectar patrones de fraude aduanero y comercial.' },
          { name: 'Clasificacion avanzada', description: 'Modelos de deep learning para clasificacion arancelaria automatica de alta precision.' },
          { name: 'Explicabilidad', description: 'Cada prediccion incluye una explicacion de los factores que la fundamentan.' }
        ]
      }
    }
  },

  '/assistant': {
    title: 'Asistente LUCI',
    description: 'Chat conversacional con LUCI IA especializado en normativa y operaciones aduaneras.',
    tabs: {
      uso: {
        sections: [
          { title: 'Chat con LUCI', text: 'Conversa con LUCI IA para resolver dudas sobre normativa aduanera, procedimientos y operaciones.' },
          { title: 'Capacidades', text: 'LUCI puede consultar normativa, analizar documentos, clasificar mercancias y asesorar sobre procedimientos.' }
        ],
        steps: [
          'Escribe tu consulta en lenguaje natural',
          'LUCI analizara tu pregunta y buscara la informacion relevante',
          'Revisa la respuesta con las referencias normativas citadas',
          'Profundiza con preguntas de seguimiento si necesitas mas detalle'
        ]
      },
      normativa: {
        regulations: [
          { code: 'CAU completo', title: 'Codigo Aduanero de la Union', description: 'LUCI tiene acceso al CAU completo y puede citar articulos especificos.', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'Legislacion nacional', title: 'Normativa espanola', description: 'Acceso a la legislacion nacional aduanera y tributaria espanola.', url: 'https://www.boe.es/' }
        ]
      },
      luciIA: {
        features: [
          { name: 'Chat especializado', description: 'Conversacion en lenguaje natural con un asistente IA experto en aduanas.' },
          { name: 'Citacion normativa', description: 'Cada respuesta incluye referencias a los articulos normativos relevantes.' },
          { name: 'Analisis de documentos', description: 'Puedes adjuntar documentos para que LUCI los analice y extraiga informacion relevante.' },
          { name: 'Contexto operativo', description: 'LUCI tiene en cuenta el contexto de tus operaciones activas para dar respuestas mas precisas.' }
        ]
      }
    }
  }
}

export default helpContent
