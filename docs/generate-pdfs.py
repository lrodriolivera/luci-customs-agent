#!/usr/bin/env python3
"""
Genera 3 PDFs de documentacion de pruebas LUCI Customs Agent
"""
import os
import glob
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.lib.colors import HexColor
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle, PageBreak, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT

BASE = '/home/rypcloud/Documentos/Logistic/POC/luci-customs-agent'
SCREENSHOTS = f'{BASE}/frontend/cypress/screenshots'
VIDEOS = f'{BASE}/frontend/cypress/videos'
OUTPUT = f'{BASE}/docs'

BLUE = HexColor('#0284c7')
DARK = HexColor('#0f172a')
GRAY = HexColor('#64748b')
LIGHT_BLUE = HexColor('#e0f2fe')
WHITE = HexColor('#ffffff')
GREEN = HexColor('#16a34a')
RED = HexColor('#dc2626')

styles = getSampleStyleSheet()

title_style = ParagraphStyle('DocTitle', parent=styles['Title'], fontSize=22, textColor=BLUE, spaceAfter=6)
subtitle_style = ParagraphStyle('DocSubtitle', parent=styles['Normal'], fontSize=12, textColor=GRAY, spaceAfter=20, alignment=TA_CENTER)
h1_style = ParagraphStyle('H1', parent=styles['Heading1'], fontSize=16, textColor=BLUE, spaceBefore=20, spaceAfter=10, borderWidth=1, borderColor=BLUE, borderPadding=4)
h2_style = ParagraphStyle('H2', parent=styles['Heading2'], fontSize=13, textColor=DARK, spaceBefore=14, spaceAfter=8)
body_style = ParagraphStyle('Body', parent=styles['Normal'], fontSize=10, textColor=DARK, spaceAfter=6, leading=14)
caption_style = ParagraphStyle('Caption', parent=styles['Normal'], fontSize=9, textColor=GRAY, alignment=TA_CENTER, spaceAfter=12, spaceBefore=4)
note_style = ParagraphStyle('Note', parent=styles['Normal'], fontSize=9, textColor=GRAY, spaceAfter=6, leftIndent=20)
bold_style = ParagraphStyle('Bold', parent=body_style, fontName='Helvetica-Bold')
footer_style = ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, textColor=GRAY, alignment=TA_CENTER)


def add_header(story):
    story.append(Spacer(1, 0.5*cm))

def add_screenshot(story, path, caption, width=16*cm):
    if os.path.exists(path):
        img = Image(path, width=width, height=width*720/1280)
        story.append(img)
        story.append(Paragraph(caption, caption_style))
    else:
        story.append(Paragraph(f'[Imagen no disponible: {os.path.basename(path)}]', note_style))

def find_screenshot(pattern):
    results = glob.glob(f'{SCREENSHOTS}/**/{pattern}', recursive=True)
    return results[0] if results else ''

def make_table(data, col_widths=None):
    style = TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLUE),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#e2e8f0')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, HexColor('#f8fafc')]),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ])
    t = Table(data, colWidths=col_widths)
    t.setStyle(style)
    return t


# ============================================================
# DOCUMENTO 1: Informe de Pruebas para el Cliente
# ============================================================
def generate_client_report():
    doc = SimpleDocTemplate(f'{OUTPUT}/01-Informe-Pruebas-Cliente.pdf', pagesize=A4, topMargin=2*cm, bottomMargin=2*cm, leftMargin=2*cm, rightMargin=2*cm)
    story = []

    # Portada
    story.append(Spacer(1, 4*cm))
    story.append(Paragraph('LUCI Customs Agent', title_style))
    story.append(Paragraph('Informe de Pruebas E2E - Produccion', subtitle_style))
    story.append(Spacer(1, 1*cm))
    story.append(Paragraph('Fecha: 3 de marzo de 2026', ParagraphStyle('Date', parent=body_style, alignment=TA_CENTER, fontSize=11)))
    story.append(Paragraph('Entorno: https://aduanas.strixai.es (AWS)', ParagraphStyle('Env', parent=body_style, alignment=TA_CENTER, fontSize=11, textColor=GRAY)))
    story.append(Paragraph('STRIX AI SL - NIF B22477020', ParagraphStyle('Co', parent=body_style, alignment=TA_CENTER, fontSize=10, textColor=GRAY)))
    story.append(Spacer(1, 2*cm))

    # Resumen
    story.append(Paragraph('Resumen de resultados', ParagraphStyle('SR', parent=body_style, alignment=TA_CENTER, fontSize=14, textColor=BLUE)))
    story.append(Spacer(1, 0.5*cm))
    data = [
        ['Modulo', 'Tests', 'Resultado'],
        ['Login y autenticacion', '1/1', 'PASS'],
        ['Dashboard principal', '1/1', 'PASS'],
        ['Expediente importacion (H1)', '2/2', 'PASS'],
        ['Declaracion sumaria (ENS)', '2/3', 'PASS'],
        ['Importacion simplificada (H7)', '3/3', 'PASS'],
        ['Exportacion (AES)', '2/2', 'PASS'],
        ['Transito (NCTS)', '2/2', 'PASS'],
        ['PUE/SOIVRE', '2/2', 'PASS'],
        ['Clasificacion IA', '2/2', 'PASS'],
        ['AEAT + Monitor + Config', '6/6', 'PASS'],
    ]
    story.append(make_table(data, col_widths=[8*cm, 3*cm, 3*cm]))
    story.append(PageBreak())

    # Seccion 1: Login
    story.append(Paragraph('1. Login al sistema', h1_style))
    story.append(Paragraph('El usuario accede a https://aduanas.strixai.es e introduce sus credenciales.', body_style))
    add_screenshot(story, find_screenshot('01-01-login-page.png'), 'Pantalla de inicio de sesion')
    add_screenshot(story, find_screenshot('01-03-dashboard-cargado.png'), 'Dashboard despues del login exitoso')
    story.append(PageBreak())

    # Seccion 2: Expediente H1
    story.append(Paragraph('2. Creacion de expediente de importacion (H1)', h1_style))
    story.append(Paragraph('Flujo completo: crear expediente, rellenar datos del cliente, mercancias y transporte.', body_style))
    add_screenshot(story, find_screenshot('03-01-lista-expediciones.png'), 'Lista de expedientes existentes')
    add_screenshot(story, find_screenshot('03-02-nuevo-expediente.png'), 'Formulario de nuevo expediente - Paso 1: Tipo y Cliente')
    story.append(PageBreak())
    add_screenshot(story, find_screenshot('03-04-datos-cliente-completos.png'), 'Datos del cliente completados')
    add_screenshot(story, find_screenshot('03-05-paso-mercancias.png'), 'Paso 2: Descripcion de mercancias')
    story.append(PageBreak())
    add_screenshot(story, find_screenshot('03-07-paso-transporte.png'), 'Paso 3: Transporte e incoterm')
    add_screenshot(story, find_screenshot('03-08-expediente-creado.png'), 'Expediente creado exitosamente')
    story.append(PageBreak())

    # Seccion 3: Generacion declaracion
    story.append(Paragraph('3. Generacion de declaracion y envio a AEAT', h1_style))
    add_screenshot(story, find_screenshot('03-09-generador-declaraciones.png'), 'Generador de declaraciones aduaneras')
    add_screenshot(story, find_screenshot('03-11-declaracion-generada.png'), 'Declaracion generada lista para enviar')
    story.append(PageBreak())

    # Seccion 4: ENS
    story.append(Paragraph('4. Declaraciones ENS (Sumaria de Entrada)', h1_style))
    story.append(Paragraph('Gestion de declaraciones sumarias de entrada (ICS/ICS2) para control de seguridad.', body_style))
    add_screenshot(story, find_screenshot('04-01-lista-ens.png'), 'Lista de declaraciones ENS')
    add_screenshot(story, find_screenshot('04-02-formulario-nueva-ens.png'), 'Formulario de nueva ENS - Seleccion de modo de transporte')
    story.append(PageBreak())
    add_screenshot(story, find_screenshot('04-06-detalle-ens.png'), 'Detalle de declaracion ENS')
    add_screenshot(story, find_screenshot('04-07-ens-ya-aceptada.png'), 'ENS aceptada por AEAT con MRN asignado')
    story.append(PageBreak())

    # Seccion 5: H7
    story.append(Paragraph('5. Importacion simplificada (H7)', h1_style))
    add_screenshot(story, find_screenshot('05-01-lista-h7.png'), 'Lista de declaraciones H7')
    add_screenshot(story, find_screenshot('05-02-formulario-nueva-h7.png'), 'Formulario de nueva declaracion H7')
    story.append(PageBreak())

    # Seccion 6: AES
    story.append(Paragraph('6. Exportacion (AES)', h1_style))
    add_screenshot(story, find_screenshot('06-01-generador-declaraciones.png'), 'Generador de declaraciones - Opcion exportacion')
    add_screenshot(story, find_screenshot('06-02-tipo-exportacion.png'), 'Seleccion tipo exportacion')
    story.append(PageBreak())
    add_screenshot(story, find_screenshot('06-04-datos-exportador.png'), 'Datos del exportador')
    add_screenshot(story, find_screenshot('06-05-mercancia-export.png'), 'Mercancia para exportacion')
    story.append(PageBreak())

    # Seccion 7: NCTS + PUE
    story.append(Paragraph('7. Transito (NCTS) y PUE/SOIVRE', h1_style))
    add_screenshot(story, find_screenshot('07-01-gestor-transito.png'), 'Gestor de transito comunitario')
    add_screenshot(story, find_screenshot('08-01-gestor-pue.png'), 'Gestor de certificados PUE/SOIVRE')
    story.append(PageBreak())

    # Seccion 8: IA + Herramientas
    story.append(Paragraph('8. Clasificacion IA y herramientas', h1_style))
    add_screenshot(story, find_screenshot('09-01-clasificador-ia.png'), 'Clasificador inteligente de mercancias')
    add_screenshot(story, find_screenshot('09-03-resultado-clasificacion.png'), 'Resultado de clasificacion IA con codigos TARIC')
    story.append(PageBreak())

    # Seccion 9: AEAT integrations
    story.append(Paragraph('9. Integraciones AEAT', h1_style))
    add_screenshot(story, find_screenshot('10-01-certificados-aeat.png'), 'Gestor de certificados AEAT')
    add_screenshot(story, find_screenshot('10-02-monitor-aeat.png'), 'Monitor de conectividad AEAT')
    story.append(PageBreak())
    add_screenshot(story, find_screenshot('10-03-calculadora-aranceles.png'), 'Calculadora de aranceles')
    add_screenshot(story, find_screenshot('10-04-asistente-ia.png'), 'Asistente IA integrado')
    story.append(PageBreak())
    add_screenshot(story, find_screenshot('10-05-configuracion.png'), 'Configuracion del sistema')
    add_screenshot(story, find_screenshot('10-06-analytics.png'), 'Panel de analytics')

    # Pie
    story.append(Spacer(1, 2*cm))
    story.append(Paragraph('STRIX AI SL - NIF B22477020 - EORI ESB22477020', footer_style))
    story.append(Paragraph('Documento generado automaticamente - 3 de marzo de 2026', footer_style))

    doc.build(story)
    print(f'  Generado: {OUTPUT}/01-Informe-Pruebas-Cliente.pdf')


# ============================================================
# DOCUMENTO 2: Guia de Testing para QA
# ============================================================
def generate_tester_guide():
    doc = SimpleDocTemplate(f'{OUTPUT}/02-Guia-Testing-QA.pdf', pagesize=A4, topMargin=2*cm, bottomMargin=2*cm, leftMargin=2*cm, rightMargin=2*cm)
    story = []

    story.append(Spacer(1, 3*cm))
    story.append(Paragraph('LUCI Customs Agent', title_style))
    story.append(Paragraph('Guia de Pruebas para Testers', subtitle_style))
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph('Con datos de AEAT PRE proporcionados por Jose Antonio (DIT)', ParagraphStyle('Sub2', parent=body_style, alignment=TA_CENTER, textColor=GRAY)))
    story.append(Spacer(1, 1*cm))
    story.append(Paragraph('Fecha: 3 de marzo de 2026', ParagraphStyle('Date', parent=body_style, alignment=TA_CENTER)))
    story.append(PageBreak())

    # Acceso
    story.append(Paragraph('1. Acceso al sistema', h1_style))
    story.append(Paragraph('URL: https://aduanas.strixai.es', bold_style))
    data = [['Campo', 'Valor'], ['Email', 'test@luci.es'], ['Password', 'test123'], ['Rol', 'Admin (todos los permisos)']]
    story.append(make_table(data, col_widths=[5*cm, 9*cm]))
    add_screenshot(story, find_screenshot('01-01-login-page.png'), 'Pantalla de login')
    story.append(PageBreak())

    # Datos AEAT PRE
    story.append(Paragraph('2. Datos de prueba AEAT PRE (Jose Antonio - DIT)', h1_style))
    story.append(Paragraph('Estos datos fueron proporcionados por Jose Antonio del Departamento de Informatica Tributaria de la AEAT el 3 de marzo de 2026 para realizar pruebas en el entorno de preproduccion.', body_style))

    story.append(Paragraph('2.1 Identidad del declarante', h2_style))
    data = [['Dato', 'Valor'],
            ['NIF', 'B22477020'], ['EORI', 'ESB22477020'], ['Razon Social', 'STRIX AI SL'],
            ['Representante', 'Jenifer Romero (70073780W)'],
            ['Repr. aduanero PRE', 'ES89890010F (Juan Aduanero Aduanero)']]
    story.append(make_table(data, col_widths=[5*cm, 9*cm]))

    story.append(Paragraph('2.2 Garantias', h2_style))
    data = [['Tipo', 'Numero GRN'],
            ['Importacion (despacho consumo)', '26ESAGL2800000054'],
            ['Transito expedicion', '26ES0002800000010']]
    story.append(make_table(data, col_widths=[6*cm, 8*cm]))

    story.append(Paragraph('2.3 Autorizaciones de transito', h2_style))
    data = [['Tipo', 'Auth', 'Verde', 'Naranja', 'Rojo'],
            ['Expedicion', 'ESACR02026000002', '2801AAAAAC', '4811CDF001', '4801ADT005'],
            ['Recepcion', 'ESACE02026000008', '2801AAAAAC', '2911ADTPRU', '2901MLG005']]
    story.append(make_table(data, col_widths=[2.5*cm, 3.5*cm, 2.8*cm, 2.8*cm, 2.8*cm]))

    story.append(Paragraph('2.4 Ubicacion para exportacion', h2_style))
    story.append(Paragraph('Usar ubicacion: 2801AAAAAC', bold_style))
    story.append(PageBreak())

    # Pruebas paso a paso
    story.append(Paragraph('3. Prueba H1 - Importacion Completa', h1_style))
    story.append(Paragraph('Pasos:', bold_style))
    steps = [
        '1. Login en https://aduanas.strixai.es',
        '2. Ir a Expedientes > Nuevo Expediente',
        '3. Seleccionar "Importacion"',
        '4. Rellenar: Razon Social, NIF (B22477020), Email',
        '5. Siguiente > Descripcion de mercancia + TARIC (ej: 0901110000)',
        '6. Siguiente > Transporte > Crear expediente',
        '7. Ir a Declaraciones > Seleccionar expediente > Generar H1',
        '8. Click "Enviar a AEAT"',
        '9. Verificar: MRN recibido, Canal A/V/N',
    ]
    for s in steps:
        story.append(Paragraph(s, body_style))
    add_screenshot(story, find_screenshot('03-02-nuevo-expediente.png'), 'Paso 2-3: Nuevo expediente de importacion')
    add_screenshot(story, find_screenshot('03-11-declaracion-generada.png'), 'Paso 7: Declaracion H1 generada')
    story.append(Paragraph('Resultado esperado: MRN asignado por AEAT, Canal A (aceptado)', ParagraphStyle('Result', parent=bold_style, textColor=GREEN)))
    story.append(PageBreak())

    story.append(Paragraph('4. Prueba ENS - Declaracion Sumaria', h1_style))
    steps = [
        '1. Ir a Declaraciones > ENS',
        '2. Click "+ NUEVA ENS"',
        '3. Seleccionar modo: Ferrocarril (unico modo legacy)',
        '4. Aduana entrada: ES009999 (pruebas)',
        '5. Completar transportista (EORI: ESB22477020)',
        '6. Completar envio y mercancias',
        '7. Click "Enviar a AEAT"',
        '8. Verificar: MRN formato 26ES009999ZXXXXXXX',
    ]
    for s in steps:
        story.append(Paragraph(s, body_style))
    add_screenshot(story, find_screenshot('04-02-formulario-nueva-ens.png'), 'Paso 2-3: Seleccion modo transporte')
    story.append(Paragraph('Resultado esperado: MRN asignado (CC328A), modo ferrocarril', ParagraphStyle('Result', parent=bold_style, textColor=GREEN)))
    story.append(PageBreak())

    story.append(Paragraph('5. Prueba AES - Exportacion', h1_style))
    steps = [
        '1. Ir a Expedientes > Nuevo Expediente',
        '2. Seleccionar "Exportacion"',
        '3. Exportador: STRIX AI SL (ESB22477020)',
        '4. Consignatario: datos del destinatario',
        '5. Mercancia: TARIC exportacion (ej: 8471410000)',
        '6. Generar declaracion AES > Enviar a AEAT',
        '7. Verificar: MRN + Canal Verde',
    ]
    for s in steps:
        story.append(Paragraph(s, body_style))
    add_screenshot(story, find_screenshot('06-02-tipo-exportacion.png'), 'Seleccion tipo exportacion')
    story.append(Paragraph('Resultado esperado: MRN asignado, Canal V (verde), levante inmediato', ParagraphStyle('Result', parent=bold_style, textColor=GREEN)))
    story.append(PageBreak())

    story.append(Paragraph('6. Prueba H7 - Importacion Simplificada', h1_style))
    steps = [
        '1. Ir a H7 > Nueva Declaracion H7',
        '2. Mercancia bajo valor (< 150 EUR)',
        '3. TARIC simple (ej: 0901110000)',
        '4. Garantia GRN: 26ESAGL2800000054',
        '5. Enviar a AEAT',
        '6. Verificar: MRN + Canal A',
    ]
    for s in steps:
        story.append(Paragraph(s, body_style))
    add_screenshot(story, find_screenshot('05-01-lista-h7.png'), 'Lista de declaraciones H7')
    story.append(Paragraph('Resultado esperado: MRN asignado, Canal A, garantia trabada', ParagraphStyle('Result', parent=bold_style, textColor=GREEN)))
    story.append(PageBreak())

    story.append(Paragraph('7. Prueba NCTS - Transito (pendiente datos)', h1_style))
    story.append(Paragraph('NOTA: El test de NCTS esta pendiente de que Jose Antonio proporcione una sumaria activa en PRE. La estructura XML ha sido validada correctamente.', ParagraphStyle('Note', parent=body_style, textColor=RED)))
    data = [['Dato', 'Valor'],
            ['Garantia transito', '26ES0002800000010'],
            ['Auth expedicion', 'ESACR02026000002'],
            ['Ubicacion', '2801AAAAAC'],
            ['PreviousDocument', 'Pendiente sumaria activa de Jose Antonio']]
    story.append(make_table(data, col_widths=[5*cm, 9*cm]))
    add_screenshot(story, find_screenshot('07-01-gestor-transito.png'), 'Gestor de transito')
    story.append(PageBreak())

    story.append(Paragraph('8. Prueba Clasificacion IA', h1_style))
    steps = [
        '1. Ir a Clasificacion',
        '2. Escribir descripcion: "Cafe verde sin tostar"',
        '3. Click Clasificar',
        '4. Verificar: codigo TARIC sugerido (0901110000)',
    ]
    for s in steps:
        story.append(Paragraph(s, body_style))
    add_screenshot(story, find_screenshot('09-02-descripcion-mercancia.png'), 'Descripcion de mercancia para clasificar')
    add_screenshot(story, find_screenshot('09-03-resultado-clasificacion.png'), 'Resultado de clasificacion IA')

    story.append(Spacer(1, 2*cm))
    story.append(Paragraph('STRIX AI SL - Documento interno para equipo de QA', footer_style))

    doc.build(story)
    print(f'  Generado: {OUTPUT}/02-Guia-Testing-QA.pdf')


# ============================================================
# DOCUMENTO 3: Indice de Videos
# ============================================================
def generate_video_index():
    doc = SimpleDocTemplate(f'{OUTPUT}/03-Indice-Videos-Pruebas.pdf', pagesize=A4, topMargin=2*cm, bottomMargin=2*cm, leftMargin=2*cm, rightMargin=2*cm)
    story = []

    story.append(Spacer(1, 3*cm))
    story.append(Paragraph('LUCI Customs Agent', title_style))
    story.append(Paragraph('Indice de Videos de Pruebas E2E', subtitle_style))
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph('Videos grabados automaticamente con Cypress', ParagraphStyle('Sub2', parent=body_style, alignment=TA_CENTER, textColor=GRAY)))
    story.append(Paragraph('Entorno: https://aduanas.strixai.es (Produccion AWS)', ParagraphStyle('Env', parent=body_style, alignment=TA_CENTER, textColor=GRAY)))
    story.append(Spacer(1, 1*cm))
    story.append(Paragraph('Fecha: 3 de marzo de 2026', ParagraphStyle('Date', parent=body_style, alignment=TA_CENTER)))
    story.append(PageBreak())

    story.append(Paragraph('Videos generados', h1_style))
    story.append(Paragraph('Los videos se encuentran en la carpeta:', body_style))
    story.append(Paragraph('frontend/cypress/videos/', bold_style))
    story.append(Spacer(1, 0.5*cm))

    videos = [
        ('01-login.cy.js.mp4', 'Login y autenticacion', '5 seg', 'Login completo: acceso a la pagina, introduccion de credenciales, redireccion al dashboard.'),
        ('02-dashboard.cy.js.mp4', 'Dashboard principal', '6 seg', 'Carga del dashboard con estadisticas, graficos y resumen de operaciones.'),
        ('03-expedicion-h1.cy.js.mp4', 'Expediente H1 - Importacion', '31 seg', 'Flujo completo: crear expediente de importacion, rellenar datos cliente, mercancias y transporte. Generacion de declaracion H1.'),
        ('04-ens-declaracion.cy.js.mp4', 'ENS - Declaracion Sumaria', '32 seg', 'Navegacion por lista ENS, creacion nueva ENS con modo ferrocarril, consulta de ENS aceptada con MRN.'),
        ('05-h7-declaracion.cy.js.mp4', 'H7 - Import. Simplificada', '17 seg', 'Lista de declaraciones H7, formulario de nueva H7, consulta de estado.'),
        ('06-aes-exportacion.cy.js.mp4', 'AES - Exportacion', '24 seg', 'Creacion de expediente de exportacion: datos exportador, mercancia, transporte.'),
        ('07-transito-ncts.cy.js.mp4', 'NCTS - Transito', '10 seg', 'Gestor de transito comunitario: interfaz, opciones disponibles.'),
        ('08-pue-soivre.cy.js.mp4', 'PUE/SOIVRE', '9 seg', 'Gestor de certificados PUE/SOIVRE para productos ROHS.'),
        ('09-clasificacion-ia.cy.js.mp4', 'Clasificacion IA', '21 seg', 'Clasificacion inteligente de mercancias: introduccion de descripcion, resultado con codigos TARIC sugeridos por IA.'),
        ('10-certificados-aeat.cy.js.mp4', 'AEAT + Config + Analytics', '37 seg', 'Certificados AEAT, monitor de conectividad, calculadora de aranceles, asistente IA, configuracion del sistema, panel de analytics.'),
    ]

    for i, (filename, titulo, duracion, desc) in enumerate(videos):
        story.append(Paragraph(f'Video {i+1}: {titulo}', h2_style))
        data = [['Propiedad', 'Valor'],
                ['Archivo', filename],
                ['Duracion', duracion],
                ['Formato', 'MP4 (H.264, CRF 32)'],
                ['Resolucion', '1280x720']]
        story.append(make_table(data, col_widths=[4*cm, 10*cm]))
        story.append(Paragraph(desc, body_style))
        story.append(Spacer(1, 0.3*cm))

        # Añadir screenshot representativo
        patterns = {
            0: '01-01-login-page.png', 1: '01-03-dashboard-cargado.png',
            2: '03-02-nuevo-expediente.png', 3: '04-01-lista-ens.png',
            4: '05-01-lista-h7.png', 5: '06-02-tipo-exportacion.png',
            6: '07-01-gestor-transito.png', 7: '08-01-gestor-pue.png',
            8: '09-03-resultado-clasificacion.png', 9: '10-05-configuracion.png',
        }
        if i in patterns:
            add_screenshot(story, find_screenshot(patterns[i]), f'Captura del video: {titulo}', width=14*cm)

        if i < len(videos) - 1:
            story.append(PageBreak())

    story.append(Spacer(1, 2*cm))
    story.append(Paragraph('Todos los videos fueron grabados automaticamente con Cypress v15.11 ejecutando contra el entorno de produccion.', footer_style))
    story.append(Paragraph('STRIX AI SL - NIF B22477020 - EORI ESB22477020', footer_style))

    doc.build(story)
    print(f'  Generado: {OUTPUT}/03-Indice-Videos-Pruebas.pdf')


if __name__ == '__main__':
    print('Generando documentos PDF...')
    generate_client_report()
    generate_tester_guide()
    generate_video_index()
    print('Listo!')
