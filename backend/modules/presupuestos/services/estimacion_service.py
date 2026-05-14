import os
from decimal import Decimal

from django.db import transaction

from materials.services.utils.normalizer import coincide_material, normalizar_material
from modules.materiales.models import Material, PrecioMaterialScrapeado

from ..models import Presupuesto, PresupuestoItem

COEFICIENTES_BASE_M2 = [
    {"material": "cemento", "unidad": "bolsa", "cantidad_m2": Decimal("0.12")},
    {"material": "arena", "unidad": "m3", "cantidad_m2": Decimal("0.05")},
    {"material": "ladrillo", "unidad": "unidad", "cantidad_m2": Decimal("35")},
    {"material": "hierro", "unidad": "kg", "cantidad_m2": Decimal("4.2")},
    {"material": "pintura", "unidad": "litro", "cantidad_m2": Decimal("0.08")},
]

AJUSTE_POR_AMBIENTE = {
    "bano": {"cemento": Decimal("1.10"), "pintura": Decimal("0.90")},
    "baño": {"cemento": Decimal("1.10"), "pintura": Decimal("0.90")},
    "cocina": {"cemento": Decimal("1.05"), "hierro": Decimal("1.05")},
    "dormitorio": {"pintura": Decimal("1.15")},
}


def _obtener_material(nombre: str, unidad: str) -> Material | None:
    nombre = (nombre or "").strip()
    if not nombre:
        return None

    # 1) Match exacto en catálogo
    material = Material.objects.filter(nombre__iexact=nombre).first()

    # 2) Match por contiene (si en BD está más específico: "Cemento IP-30 ...")
    if not material:
        material = Material.objects.filter(nombre__icontains=nombre).order_by("nombre").first()

    # 3) Derivar material desde la tabla de precios scrapeados (si tiene FK a Material)
    if not material:
        registro = (
            PrecioMaterialScrapeado.objects.exclude(material__isnull=True)
            .filter(nombre_material__icontains=nombre)
            .order_by("precio", "-scrapeado_en")
            .select_related("material")
            .first()
        )
        material = getattr(registro, "material", None)

    # 4) Auto-crear si no existe en la base de datos
    if not material:
        material = Material.objects.create(
            nombre=nombre.lower(),
            unidad=unidad or "unidad",
            precio_referencial=0
        )

    return material


def _obtener_precio_desde_scrapeado(nombre: str, material: Material | None = None) -> Decimal | None:
    """Devuelve el mejor precio disponible desde la tabla PrecioMaterialScrapeado.

    No crea ni actualiza nada; solo lee la BD.
    """
    nombre_norm = normalizar_material(nombre or "")
    if not nombre_norm:
        return None

    qs = PrecioMaterialScrapeado.objects.all()
    if material is not None:
        qs = qs.filter(material=material)
    else:
        qs = qs.filter(nombre_material__icontains=nombre_norm)

    # Trae candidatos y filtra con una coincidencia más estricta en Python.
    candidatos = list(qs.order_by("precio", "-scrapeado_en")[:200])
    filtrados = [c for c in candidatos if coincide_material(nombre_norm, c.nombre_material or "")]
    elegido = (filtrados[0] if filtrados else (candidatos[0] if candidatos else None))
    if not elegido:
        return None

    try:
        precio = Decimal(str(elegido.precio or 0)).quantize(Decimal("0.01"))
    except Exception:  # noqa: BLE001
        return None
    if precio <= 0:
        return None
    return precio


def _calcular_area_total(presupuesto: Presupuesto) -> Decimal:
    """Calcula el área total considerando todos los ambientes del proyecto."""
    presupuesto_obj = presupuesto
    proyecto = presupuesto_obj.proyecto
    
    if not proyecto:
        return Decimal("80")
    
    try:
        num_pisos = int(getattr(proyecto, 'num_pisos', 1) or 1)
    except Exception:
        num_pisos = 1
    
    # Si el presupuesto tiene un ambiente específico y este tiene área, la usamos
    if presupuesto_obj.ambiente and presupuesto_obj.ambiente.area_m2:
        area_ambiente = Decimal(str(presupuesto_obj.ambiente.area_m2))
        return area_ambiente * Decimal(str(max(num_pisos, 1)))
    
    # Calcular área total desde los ambientes del proyecto
    from modules.planos.models import Ambiente, Plano
    try:
        ambientes = Ambiente.objects.filter(plano__proyecto=proyecto)
    except Exception:
        ambientes = []
    
    area_total = Decimal("0")
    for amb in ambientes:
        if amb.area_m2 and amb.area_m2 > 0:
            area_total += Decimal(str(amb.area_m2))
    
    if area_total > 0:
        return area_total * Decimal(str(max(num_pisos, 1)))
    
    # Si no hay áreas calculadas en los ambientes, calcular por vectores en los planos del proyecto
    try:
        if presupuesto_obj.ambiente and presupuesto_obj.ambiente.plano:
            planos = [presupuesto_obj.ambiente.plano]
        else:
            planos = Plano.objects.filter(proyecto=proyecto)
            
        area_estimada = Decimal("0")
        areas_elementos = {
            'muro': Decimal('30'),    # ~3m x 10m
            'puerta': Decimal('1.8'),  # ~1.8m x 1m
            'ventana': Decimal('1.5'), # ~1.5m x 1m
        }
        
        for plano in planos:
            vector = plano.datos_vectoriales if isinstance(plano.datos_vectoriales, list) else []
            for elemento in vector:
                if isinstance(elemento, dict):
                    tipo = str(elemento.get('tipo', '')).lower()
                    if tipo in areas_elementos:
                        area_estimada += areas_elementos[tipo]
                        
        if area_estimada > 0:
            return area_estimada * Decimal(str(max(num_pisos, 1)))
    except Exception:
        pass
    
    # Si todo falla, usar un tamaño por defecto
    return Decimal("80")


def _factor_refinado(presupuesto: Presupuesto) -> Decimal:
    ambiente = presupuesto.ambiente
    if not ambiente or not ambiente.plano:
        return Decimal("1.00")

    plano = ambiente.plano
    vector = plano.datos_vectoriales if isinstance(plano.datos_vectoriales, list) else []
    if not vector:
        return Decimal("1.00")

    try:
        escala = Decimal(str(plano.escala_metros_por_pixel or 0.01))
    except Exception:  # noqa: BLE001
        escala = Decimal("0.01")

    muros = [item for item in vector if str(item.get("tipo") or "").lower() == "muro"]
    puertas = [item for item in vector if str(item.get("tipo") or "").lower() == "puerta"]
    ventanas = [item for item in vector if str(item.get("tipo") or "").lower() == "ventana"]

    longitud_muros = Decimal("0")
    for muro in muros:
        w = Decimal(str(muro.get("width") or 0))
        h = Decimal(str(muro.get("height") or 0))
        longitud_muros += max(w, h) * escala

    # Ajuste pequeño para aproximar complejidad de diseño.
    ajuste_muros = min(Decimal("0.25"), longitud_muros / Decimal("120"))
    ajuste_aperturas = min(Decimal("0.10"), Decimal(len(puertas) + len(ventanas)) * Decimal("0.005"))
    factor = Decimal("1.00") + ajuste_muros + ajuste_aperturas
    return min(Decimal("1.35"), factor).quantize(Decimal("0.01"))


def _actualizar_precios_con_gemini(nombres_materiales: list[str]):
    try:
        from django.conf import settings
        import google.generativeai as genai
        import json
        api_key = str(getattr(settings, "GEMINI_API_KEY", "") or "").strip()
        if not api_key:
            return
            
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.5-flash")
        prompt = f"""
        Eres un experto contratista en Bolivia.
        Dame los precios de mercado actuales (en Bolivianos - BOB) para estos materiales de construcción: {nombres_materiales}.
        Usa las siguientes referencias de unidades estándar en Bolivia:
        - Cemento: precio por BOLSA de 50kg (aprox 50-60 Bs)
        - Ladrillo (6 huecos): precio por UNIDAD (aprox 1.20-1.50 Bs)
        - Arena: precio por M3 (metro cúbico) (aprox 100-150 Bs)
        - Puerta: precio promedio por UNIDAD económica (aprox 250-500 Bs)
        - Ventana: precio promedio por UNIDAD económica (aprox 200-400 Bs)
        - Hierro/Acero: precio por KG (aprox 7-10 Bs)
        - Pintura: precio por LITRO (aprox 15-25 Bs)
        
        Devuelve ÚNICAMENTE un JSON válido con el formato: {{"nombre_material": precio_numerico}}.
        Ejemplo: {{"cemento": 55.50, "ladrillo": 1.30}}
        """
        res = model.generate_content(prompt)
        text = res.text.strip()
        if text.startswith("```json"): text = text[7:]
        if text.startswith("```"): text = text[3:]
        if text.endswith("```"): text = text[:-3]
        
        precios_ia = json.loads(text.strip())
        
        for nombre, precio in precios_ia.items():
            mat = _obtener_material(nombre, "")
            if mat:
                mat.precio_referencial = Decimal(str(precio)).quantize(Decimal("0.01"))
                mat.save(update_fields=['precio_referencial'])
    except Exception as e:
        print(f"Error al obtener precios con IA: {e}")

def _generar_items_desde_plano_ia(presupuesto: Presupuesto) -> int:
    """
    PUNTO 4: Genera los items del presupuesto calculando geométricamente
    las cantidades exactas a partir del plano generado por la IA (vector_data),
    y llama a Gemini para asegurar precios reales en Bs.
    """
    ambiente = presupuesto.ambiente
    # Si no hay ambiente ligado, intentamos usar el primer plano del proyecto
    if not ambiente or not ambiente.plano:
        from modules.planos.models import Plano
        plano = Plano.objects.filter(proyecto=presupuesto.proyecto).first()
        if not plano:
            return 0
    else:
        plano = ambiente.plano

    vector = plano.datos_vectoriales if isinstance(plano.datos_vectoriales, list) else []
    if not vector:
        return 0

    try:
        escala = Decimal(str(plano.escala_metros_por_pixel or 0.01))
    except Exception:
        escala = Decimal("0.01")

    # 1. Separar elementos
    muros = [item for item in vector if str(item.get("tipo") or "").lower() == "muro"]
    puertas = [item for item in vector if str(item.get("tipo") or "").lower() == "puerta"]
    ventanas = [item for item in vector if str(item.get("tipo") or "").lower() == "ventana"]

    # 2. Calcular Área Neta de Muros (asumiendo altura estándar 2.5m)
    altura_muro = Decimal("2.5")
    area_bruta_muros = Decimal("0")

    for muro in muros:
        w = Decimal(str(muro.get("width") or 0))
        h = Decimal(str(muro.get("height") or 0))
        longitud_metros = max(w, h) * escala
        area_bruta_muros += longitud_metros * altura_muro

    # Restar aperturas (asumiendo tamaño promedio si no hay dimensiones 3D)
    area_puertas = Decimal(len(puertas)) * Decimal("1.89")
    area_ventanas = Decimal(len(ventanas)) * Decimal("1.8")

    area_neta_muros = area_bruta_muros - area_puertas - area_ventanas
    if area_neta_muros < 0:
        area_neta_muros = Decimal("0")

    # 3. Definir rendimiento de materiales por m2 de muro
    cant_ladrillos = (area_neta_muros * Decimal("38")).quantize(Decimal("1"))
    cant_cemento = (area_neta_muros * Decimal("0.35")).quantize(Decimal("0.1"))
    cant_arena = (area_neta_muros * Decimal("0.04")).quantize(Decimal("0.1"))

    requerimientos = [
        {"nombre": "ladrillo", "unidad": "unidad", "cantidad": cant_ladrillos},
        {"nombre": "cemento", "unidad": "bolsa", "cantidad": cant_cemento},
        {"nombre": "arena", "unidad": "m3", "cantidad": cant_arena},
    ]

    if len(puertas) > 0:
        requerimientos.append({"nombre": "puerta", "unidad": "unidad", "cantidad": Decimal(len(puertas))})
    
    if len(ventanas) > 0:
        requerimientos.append({"nombre": "ventana", "unidad": "unidad", "cantidad": Decimal(len(ventanas))})

    # 4. Actualizar Precios con IA (Gemini)
    nombres_materiales = [req["nombre"] for req in requerimientos]
    _actualizar_precios_con_gemini(nombres_materiales)

    creados = 0
    omitidos: list[dict[str, str]] = []
    for req in requerimientos:
        if req["cantidad"] <= 0:
            continue
        material = _obtener_material(req["nombre"], req["unidad"])
        if not material:
            omitidos.append({"nombre": req["nombre"], "motivo": "no existe en el catalogo"})
            continue

        precio_bd = Decimal(str(material.precio_referencial or 0)).quantize(Decimal("0.01"))
        if precio_bd <= 0:
            precio_bd = _obtener_precio_desde_scrapeado(req["nombre"], material)

        if not precio_bd or precio_bd <= 0:
            omitidos.append({"nombre": req["nombre"], "motivo": "sin precio en BD"})
            continue

        precio_unitario = precio_bd

        PresupuestoItem.objects.create(
            presupuesto=presupuesto,
            material=material,
            cantidad=req["cantidad"],
            precio_unitario=precio_unitario,
        )
        creados += 1

    return creados


def generar_items_presupuesto(
    presupuesto: Presupuesto,
    *,
    modo: str = "rapido",
    limpiar_existente: bool = True,
) -> dict:
    with transaction.atomic():
        if limpiar_existente:
            presupuesto.items.all().delete()

        # PUNTO 4: Si el modo es calcular desde el plano IA
        if modo in {"ia_vectorial", "refinado"}:
            creados = _generar_items_desde_plano_ia(presupuesto)
            # Si logró crear items desde el plano, retornamos
            if creados > 0:
                return {
                    "modo": "ia_vectorial",
                    "area_m2": 0, # Ya no aplica area bruta
                    "factor_refinado": 1.0,
                    "items_creados": creados,
                    "total_estimado": float(presupuesto.total),
                }
            # Si falla (no hay vectores), cae por defecto al modo rápido

        # Modo rápido por coeficientes de m2 (Hardcoded genérico)
        area_m2 = _calcular_area_total(presupuesto)
        if area_m2 <= 0:
            area_m2 = Decimal("80")

        tipo_ambiente = str(getattr(presupuesto.ambiente, "tipo", "") or "").strip().lower()
        ajustes = AJUSTE_POR_AMBIENTE.get(tipo_ambiente, {})

        factor_refinado = Decimal("1.00")

        # Actualizar Precios con IA (Gemini) antes de crear los items
        nombres_para_rapido = [base["material"] for base in COEFICIENTES_BASE_M2]
        _actualizar_precios_con_gemini(nombres_para_rapido)

        creados = 0
        omitidos: list[dict[str, str]] = []
        for base in COEFICIENTES_BASE_M2:
            nombre_material = base["material"]
            unidad = base["unidad"]
            coeficiente = base["cantidad_m2"]
            multiplicador = ajustes.get(nombre_material, Decimal("1.00"))

            cantidad = (area_m2 * coeficiente * multiplicador * factor_refinado).quantize(Decimal("0.01"))
            if cantidad <= 0:
                continue

            material = _obtener_material(nombre_material, unidad)
            if not material:
                omitidos.append({"nombre": nombre_material, "motivo": "no existe en el catalogo"})
                continue

            precio_unitario = Decimal(str(material.precio_referencial or 0)).quantize(Decimal("0.01"))
            if precio_unitario <= 0:
                precio_unitario = _obtener_precio_desde_scrapeado(nombre_material, material)
                if not precio_unitario or precio_unitario <= 0:
                    omitidos.append({"nombre": nombre_material, "motivo": "sin precio en BD"})
                    continue

            PresupuestoItem.objects.create(
                presupuesto=presupuesto,
                material=material,
                cantidad=cantidad,
                precio_unitario=precio_unitario,
            )
            creados += 1

    return {
        "modo": modo,
        "area_m2": float(area_m2),
        "factor_refinado": float(factor_refinado),
        "items_creados": creados,
        "materiales_omitidos": omitidos,
        "total_estimado": float(presupuesto.total),
    }
