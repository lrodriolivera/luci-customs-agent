# -*- coding: utf-8 -*-
"""
Funciones comunes para expandir un "RawCase" compacto en el diccionario
completo de datos que usa pdfgen.py, usando los pools de pools.py.
"""
import re
import random
import unicodedata
from datetime import date
from pools import COUNTRIES, COMPANIES, SEAPORTS, AIRPORTS, ROAD_CROSSINGS, \
    SEA_CARRIERS, AIR_CARRIERS, ROAD_CARRIERS, PRODUCTS
from productos_raros import PRODUCTOS_RAROS
from casos_borde import PRODUCTOS_BORDE
from productos_especiales import PRODUCTOS_ESPECIALES

ALL_PRODUCTS = {**PRODUCTS, **PRODUCTOS_RAROS, **PRODUCTOS_BORDE, **PRODUCTOS_ESPECIALES}

MODE_LABELS = {'maritime': 'Maritimo', 'air': 'Aereo', 'road': 'Carretera'}

# Territorios fiscales especiales (dentro del territorio aduanero espanol
# pero con tratamiento fiscal distinto al general). Se identifican con una
# clave compuesta 'ES-XX' en lugar de un ISO2 real.
SPECIAL_TERRITORIES = {
    'ES-CN': {'name': 'Espana (Canarias) - IGIC, fuera del territorio IVA UE', 'city': 'Las Palmas de Gran Canaria', 'port': 'Puerto de La Luz (Las Palmas)'},
    'ES-CE': {'name': 'Espana (Ceuta) - fuera del territorio aduanero UE', 'city': 'Ceuta', 'port': 'Puerto de Ceuta'},
    'ES-ME': {'name': 'Espana (Melilla) - fuera del territorio aduanero UE', 'city': 'Melilla', 'port': 'Puerto de Melilla'},
    'ES-ZF': {'name': 'Espana (Zona Franca de Barcelona)', 'city': 'Barcelona (Zona Franca)', 'port': 'Puerto de Barcelona'},
}

_rng = random.Random(20260101)

# Contador global por pais: rota entre TODAS las empresas disponibles de ese
# pais antes de repetir ninguna. Evita que, con pocos paises reutilizados en
# varios casos, siempre se elija la misma empresa (indice 0) por defecto.
_company_counters = {}


def next_company_idx(iso):
    n = _company_counters.get(iso, 0)
    _company_counters[iso] = n + 1
    pool_len = len(COMPANIES[iso]) if iso in COMPANIES else 1
    return n % pool_len


def slugify(text):
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('ascii')
    text = re.sub(r'[^\w\s-]', '', text).strip().lower()
    return re.sub(r'[\s_]+', '-', text)


def _fake_phone(country_iso):
    return f"{COUNTRIES[country_iso]['phone']} {_rng.randint(600000000, 699999999)}"


def mk_party(iso, idx, extra_eori=None, extra_nif=None, force_name=None, force_city=None):
    """Construye el dict de una empresa a partir de pools.COMPANIES.
    `iso` puede ser un ISO2 normal o una clave de SPECIAL_TERRITORIES ('ES-CN', etc.)."""
    if iso in SPECIAL_TERRITORIES:
        st = SPECIAL_TERRITORIES[iso]
        real_iso = 'ES'
        name, addr, city, postal, taxid = COMPANIES['ES'][idx % len(COMPANIES['ES'])]
        city = force_city or st['city']
        country_name = st['name']
    else:
        real_iso = iso
        name, addr, city, postal, taxid = COMPANIES[iso][idx % len(COMPANIES[iso])]
        city = force_city or city
        country_name = COUNTRIES[iso]['name']

    party = {
        'name': force_name or name,
        'address': addr,
        'city': city,
        'postal': postal,
        'country_name': country_name,
        'phone': _fake_phone(real_iso),
    }
    if COUNTRIES[real_iso]['eu']:
        party['nif'] = extra_nif or taxid
        if extra_eori:
            party['eori'] = extra_eori
        elif real_iso == 'ES':
            party['eori'] = 'ES' + re.sub(r'[^A-Z0-9]', '', taxid.upper())
    else:
        party['tax_id'] = taxid
    return party


def build_product_line(key, qty, unit_price, desc_override=None, packages=None, pack_type='CTN'):
    p = ALL_PRODUCTS[key]
    g = dict(p)
    g['qty'] = qty
    g['unit_price'] = unit_price
    if desc_override:
        g['desc'] = desc_override
    if packages:
        g['packages'] = packages
    g['pack_type'] = pack_type
    return g


def next_invoice_no(prefix, n, year=2026):
    return f"INV-{prefix}-{year}-{1000000 + (n % 9000000)}"


def next_doc_no(prefix, n, year=2026):
    return f"{prefix}{year}{1000000 + (n % 9000000)}"


def date_str(n, base_year=2026):
    m = 2 + (n % 10)
    d = 3 + (n % 24)
    return f"{d:02d}/{m:02d}/{base_year}"


def real_country_name(iso):
    if iso in SPECIAL_TERRITORIES:
        return SPECIAL_TERRITORIES[iso]['name']
    return COUNTRIES[iso]['name']


def real_city(iso, idx):
    if iso in SPECIAL_TERRITORIES:
        return SPECIAL_TERRITORIES[iso]['city']
    return COMPANIES[iso][idx % len(COMPANIES[iso])][2]


def port_for(iso, mode):
    if iso in SPECIAL_TERRITORIES:
        return SPECIAL_TERRITORIES[iso]['port']
    if mode == 'maritime':
        return SEAPORTS.get(iso, real_city(iso, 0))
    if mode == 'air':
        return AIRPORTS.get(iso, real_city(iso, 0))
    return ROAD_CROSSINGS.get(iso, real_city(iso, 0))


def carrier_for(mode, n):
    pool = {'maritime': SEA_CARRIERS, 'air': AIR_CARRIERS, 'road': ROAD_CARRIERS}[mode]
    return pool[n % len(pool)]


def _unique_seed(case_id):
    """Semilla numerica unica por caso, derivada de un hash criptografico del id
    completo (incluye sufijos EXTRANA-a/b). Una suma ponderada simple de
    caracteres colisiona con relativa facilidad entre ids distintos de longitud
    similar; con md5 truncado el riesgo de colision practico es nulo para los
    ~200 casos que maneja este generador."""
    import hashlib
    return int(hashlib.md5(case_id.encode('utf-8')).hexdigest()[:10], 16)


def expand_case(raw):
    """Convierte un RawCase compacto en el diccionario completo que consume pdfgen.py."""
    n = raw['n']
    seed = _unique_seed(raw['id']) % 90_000_000  # acotado a 8 digitos: numeros de documento realistas
    op = raw['op']
    mode = raw['mode']
    foreign_iso = raw['foreign_iso']
    es_iso = raw.get('es_iso', 'ES')

    seller_iso = foreign_iso if op == 'import' else es_iso
    buyer_iso = es_iso if op == 'import' else foreign_iso
    seller_key = seller_iso if seller_iso not in SPECIAL_TERRITORIES else 'ES'
    buyer_key = buyer_iso if buyer_iso not in SPECIAL_TERRITORIES else 'ES'
    seller_idx = next_company_idx(seller_key)
    buyer_idx = next_company_idx(buyer_key)

    seller = mk_party(seller_iso, seller_idx, extra_eori=raw.get('seller_eori'), extra_nif=raw.get('seller_nif'),
                       force_name=raw.get('seller_name'))
    buyer = mk_party(buyer_iso, buyer_idx, extra_eori=raw.get('buyer_eori'), extra_nif=raw.get('buyer_nif'),
                      force_name=raw.get('buyer_name'))

    consignee = None
    if raw.get('consignee_iso'):
        c_key = raw['consignee_iso'] if raw['consignee_iso'] not in SPECIAL_TERRITORIES else 'ES'
        consignee = mk_party(raw['consignee_iso'], next_company_idx(c_key), force_name=raw.get('consignee_name'))

    notify_party = None
    if raw.get('notify_iso'):
        nt_key = raw['notify_iso'] if raw['notify_iso'] not in SPECIAL_TERRITORIES else 'ES'
        notify_party = mk_party(raw['notify_iso'], next_company_idx(nt_key), force_name=raw.get('notify_name'))

    origin_city = real_city(seller_iso, seller_idx)
    origin_country_name = real_country_name(seller_iso)
    dest_country_name = real_country_name(buyer_iso)

    pol = port_for(seller_iso, mode)
    pod = port_for(buyer_iso, mode) if buyer_iso != 'ES' or op == 'export' else 'Puerto de Algeciras / Aduana de entrada'
    if op == 'import' and buyer_iso == 'ES':
        pod = {'maritime': 'Puerto de Algeciras', 'air': 'Madrid-Barajas (MAD)', 'road': 'Frontera de La Jonquera'}[mode]
    final_place = f"{buyer.get('city', '')}, {dest_country_name}" if op == 'export' else f"{buyer.get('city', 'Madrid')}, Espana"

    carrier = carrier_for(mode, n)
    doc_prefix = {'maritime': 'MSCU', 'air': '020-', 'road': 'CMR-'}[mode]
    doc_no = next_doc_no(doc_prefix, seed)

    transport = {
        'carrier': carrier, 'pol': pol, 'pod': pod, 'final_place': final_place,
        'doc_no': doc_no, 'etd': date_str(n), 'eta': date_str(n + 12),
    }
    if mode == 'maritime':
        transport['vessel'] = f"{carrier.split()[0].upper()} VOY. {2600 + seed}E"
        transport['containers'] = raw.get('containers') or [
            {'no': f"MSCU{4000000 + seed * 13:07d}", 'type': raw.get('container_type', '40HC'), 'seal': f"SL{90000 + seed * 3}"}
        ]
    elif mode == 'air':
        transport['vessel'] = f"Flight {carrier[:2].upper()}{100 + seed % 900}, {date_str(n)}"
    else:
        transport['vehicle_plate'] = f"{['B', 'M', 'V', 'SE', 'A'][seed % 5]}-{1000 + seed % 8999}-{['BC', 'XZ', 'KL', 'RT'][seed % 4]}"
        transport['border_crossing'] = ROAD_CROSSINGS.get(foreign_iso, 'Frontera terrestre UE')
    transport.update(raw.get('transport_over', {}))

    goods = [build_product_line(*p, packages=raw.get('packages'), pack_type=raw.get('pack_type', 'CTN'))
             for p in raw['products']]

    case = {
        'id': raw['id'], 'title': raw['title'], 'op': op,
        'transport_mode': mode, 'transport_mode_label': MODE_LABELS[mode],
        'origin_country_name': origin_country_name, 'dest_country_name': dest_country_name,
        'origin_city': origin_city,
        'seller': seller, 'buyer': buyer, 'consignee': consignee, 'notify_party': notify_party,
        'incoterm': raw['incoterm'], 'incoterm_place': raw.get('incoterm_place', origin_city),
        'currency': raw['currency'],
        'invoice_no': next_invoice_no(raw['id'], seed),
        'invoice_date': date_str(n),
        'goods': goods,
        'transport': transport,
        'extra_docs': raw.get('extra_docs', []),
        'invoice_extra_note': raw.get('invoice_note'),
        'shipping_marks': raw.get('shipping_marks'),
        'hide_hs_confidence': raw.get('hide_hs_confidence', False),
        'classification_challenge': raw.get('classification_challenge'),
        'gri_basis': raw.get('gri_basis'),
        'temp_deviation': raw.get('temp_deviation'),
    }
    return case


def build_extrano_variant(raw, producto_key, variant_letter, producto_data, qty, unit_price):
    """Construye un RawCase variante 'mercancia extrana' a partir de un caso base,
    conservando su geografia/modo/operacion pero sustituyendo la mercancia por un
    producto de dificil clasificacion TARIC, con documentacion (factura, numeros,
    empresa) totalmente propia y unica."""
    new_raw = dict(raw)
    new_raw['id'] = f"{raw['id']}-EXTRANA-{variant_letter}"
    new_raw['title'] = f"{raw['title']} — mercancia extrana {variant_letter} (test clasificacion TARIC)"
    new_raw['products'] = [(producto_key, qty, unit_price)]
    new_raw['extra_docs'] = []
    new_raw['invoice_note'] = None
    new_raw['consignee_iso'] = None
    new_raw['notify_iso'] = None
    new_raw['seller_name'] = None
    new_raw['buyer_name'] = None
    new_raw['seller_nif'] = None
    new_raw['buyer_nif'] = None
    new_raw['seller_eori'] = None
    new_raw['buyer_eori'] = None
    new_raw['hide_hs_confidence'] = True
    new_raw['classification_challenge'] = producto_data['challenge']
    return new_raw
