# chat_ia.py

import json
import os
import traceback
import requests

from datetime import datetime
from flask import Blueprint, request, jsonify
from pymongo import MongoClient
from bson.objectid import ObjectId
from dotenv import load_dotenv

# ----------------------------
# Cargar variables de entorno
# ----------------------------
load_dotenv()

OPENROUTER_API_KEY   = os.getenv("OPENROUTER_API_KEY", "").strip()
OPENROUTER_API_URL   = os.getenv("OPENROUTER_API_URL", "").strip()
OPENROUTER_MODEL     = os.getenv("OPENROUTER_MODEL", "").strip()
OWM_API_KEY = os.getenv("OWM_API_KEY", "").strip()
MONGO_URI            = os.getenv("MONGO_URI", "").strip()

# Verificación mínima de que las variables clave no estén vacías
if not OPENROUTER_API_KEY or not OPENROUTER_API_URL or not OPENROUTER_MODEL or not MONGO_URI:
    raise RuntimeError(
        "Por favor define correctamente OPENROUTER_API_KEY, OPENROUTER_API_URL, "
        "OPENROUTER_MODEL y MONGO_URI en tu .env"
    )

# ---------------------------------------------------
# Inicializar Flask Blueprint y conexión a MongoDB
# ---------------------------------------------------
chat_ia_blueprint = Blueprint("chat_ia", __name__)

client = MongoClient(MONGO_URI)
db = client["EcoSmart"]

# Colecciones
conversaciones_collection = db["conversaciones_ia"]
sensores_collection       = db["datos_sensores"]
parcelas_collection       = db["datos_parcelas"]  # para recuperar el cultivo

# ==============================================================  
# FUNCIÓN AUXILIAR: Recuperar historial completo de un chat_id  
# ==============================================================  
def _construir_mensajes_desde_historial(chat_id, prompt_nuevo=None):
    """
    Recupera del histórico en MongoDB todos los mensajes (pregunta y respuesta)
    para el chat_id dado, los ordena cronológicamente y construye
    la lista de 'messages' que necesita OpenRouter.
    Si prompt_nuevo no es None, lo añade (con role 'user') al final.
    """
    mensajes = []
    # 1) Mensaje 'system' fijo al inicio
    mensajes.append({"role": "system", "content": "Eres un asistente agronómico experto que brinda recomendaciones según el tipo de cultivo."})

    # 2) Recuperar todo el historial (pregunta + respuesta) ordenado por timestamp asc
    cursor = conversaciones_collection.find({"chat_id": chat_id}).sort("timestamp", 1)
    for doc in cursor:
        pregunta = doc.get("pregunta", "").strip()
        respuesta = doc.get("respuesta", None)
        # a) pregunta siempre existe
        if pregunta:
            mensajes.append({"role": "user", "content": pregunta})
        # b) si ya hay respuesta (no es None), agregar como mensaje de assistant
        if respuesta:
            mensajes.append({"role": "assistant", "content": respuesta})

    # 3) Si llega prompt_nuevo (caso texto_libre o sensor), ponerlo al final como user
    if prompt_nuevo:
        mensajes.append({"role": "user", "content": prompt_nuevo})

    return mensajes


# ==============================================================  
# RUTA UNIFICADA: /consulta-ia  
# Atiende tanto “texto libre” como “recomendación por sensor”  
# ==============================================================  
@chat_ia_blueprint.route("/consulta-ia", methods=["POST"])
def consulta_ia():

    PROMPT_BASE = (
        "Eres un asistente experto en el área de la agricultura. "
        "Tu función es exclusivamente responder preguntas relacionadas con prácticas agrícolas, "
        "cultivos, suelo, clima agrícola, enfermedades de plantas, nutrición vegetal, etc. "
        "Si te hacen una pregunta fuera de ese ámbito, responde amablemente que solo puedes responder "
        "consultas sobre agricultura y no estás autorizado a hablar de otros temas.\n\n"
    )


    data = request.get_json(force=True)
    chat_id = data.get("chat_id", None)
    nombre_chat = data.get("nombre_chat", "")
    tipo_peticion = data.get("tipo_peticion", "texto_libre").strip()
    ahora = datetime.utcnow()

    # ----------------------------------  
    # 1) Caso "texto_libre"  
    # ----------------------------------  
    if tipo_peticion == "texto_libre":
        pregunta_usuario = data.get("pregunta", "").strip()
        cultivo_usuario = data.get("cultivo", "").strip()  # Opcional: si el front-end envía cultivo
        if not pregunta_usuario:
            return jsonify({"error": "El campo 'pregunta' es obligatorio."}), 400

        # Si es un chat nuevo, generamos chat_id
        if not chat_id:
            chat_id = str(ObjectId())

        # Construir el prompt completo, incluyendo cultivo si se proporciona
    if cultivo_usuario:
        prompt_nuevo = (
            PROMPT_BASE +
            f"Cultivo: {cultivo_usuario}. " +
            f"Pregunta: {pregunta_usuario}"
        )

    else:
        prompt_nuevo = PROMPT_BASE + f"Pregunta: {pregunta_usuario}"


        # Antes de insertar en BD, construimos los mensajes completos para enviar a OpenRouter
        mensajes_para_ia = _construir_mensajes_desde_historial(chat_id, prompt_nuevo=prompt_nuevo)

        # Insertamos la pregunta en MongoDB (respuesta=None por ahora)
        conversaciones_collection.insert_one({
            "chat_id": chat_id,
            "nombre_chat": nombre_chat,
            "pregunta": prompt_nuevo,
            "respuesta": None,
            "timestamp": ahora
        })

        # Preparar headers y body para OpenRouter
        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json"
        }
        body = {
            "model": OPENROUTER_MODEL,
            "messages": mensajes_para_ia
            # Opcional: podrías agregar aquí "temperature", "max_tokens", etc.
        }

        try:
            respuesta = requests.post(
                OPENROUTER_API_URL,
                json=body,
                headers=headers,
                timeout=30
            )
            respuesta.raise_for_status()
            data_ia = respuesta.json()
            texto_ia = data_ia["choices"][0]["message"]["content"].strip()
        except Exception as e:
            traceback.print_exc()
            return jsonify({
                "error": "Fallo al llamar a la API de OpenRouter",
                "detalle": str(e)
            }), 502

        # Actualizamos la misma fila con la respuesta de IA
        conversaciones_collection.update_one(
            {"chat_id": chat_id, "pregunta": prompt_nuevo, "respuesta": None},
            {"$set": {"respuesta": texto_ia, "timestamp": datetime.utcnow()}}
        )

        return jsonify({"chat_id": chat_id, "respuesta": texto_ia}), 200

    # ----------------------------------  
    # 2) Caso "sensor"  
    # ----------------------------------  
    if tipo_peticion == "sensor":
        parcela_full = data.get("parcela", "").strip()  # Ej: "Parcelas Aires de Colchagua - Parcela 1"
        sensor = data.get("sensor", "").strip()
        if not parcela_full or not sensor:
            return jsonify({"error": "Los campos 'parcela' y 'sensor' son obligatorios."}), 400

        # --- 2.1) EXTRAER TIPO DE CULTIVO desde datos_parcelas ---
        cultivo_parcela = ""
        try:
            # Se asume que la cadena "parcela_full" viene en formato "NombreBase - Parcela N"
            if " - Parcela " in parcela_full:
                base_nombre, num_str = parcela_full.split(" - Parcela ")
                numero_int = int(num_str)
                query = {"nombre": base_nombre, "numero": numero_int}
                doc_parcela = parcelas_collection.find_one(query)
                if doc_parcela and "cultivo" in doc_parcela:
                    cultivo_parcela = doc_parcela["cultivo"]
        except Exception:
            # Si algo falla (por ejemplo no coincide el formato), dejamos cultivo_parcela = ""
            cultivo_parcela = ""

        # --- 2.2) Obtener la última lectura en sensores_collection ---
        cursor_ultimo = sensores_collection.find(
            {"parcela": parcela_full, "tipo": sensor}
        ).sort("timestamp", -1).limit(1)
        lista_docs = list(cursor_ultimo)
        if not lista_docs:
            return jsonify({
                "error": f"No hay lecturas de '{sensor}' en '{parcela_full}'."
            }), 404
        lectura = lista_docs[0]

        # --- 2.3) Construir texto_lectura según el tipo de sensor ---
        if sensor.lower() == "temperatura ambiente":
            valor = lectura.get("temperatura", None)
            texto_lectura = f"Temperatura Ambiente: {valor} °C" if valor is not None else "Valor no disponible"
        elif sensor.lower() == "nivel de ph":
            valor = lectura.get("ph_suelo", None)
            texto_lectura = f"Nivel de pH: {valor}" if valor is not None else "Valor no disponible"
        elif sensor.lower() == "humedad del suelo":
            valor = lectura.get("humedad_suelo", None)
            texto_lectura = f"Humedad del suelo: {valor} %" if valor is not None else "Valor no disponible"
        elif sensor.lower() == "nivel de nutrientes":
            nutr = lectura.get("nutrientes", {})
            n = nutr.get("nitrógeno", None)
            p = nutr.get("fósforo", None)
            k = nutr.get("potasio", None)
            texto_lectura = f"Nitrógeno: {n}, Fósforo: {p}, Potasio: {k}"
        else:
            campo = sensor.lower().replace(" ", "_")
            valor = lectura.get(campo, None)
            texto_lectura = f"{sensor}: {valor}" if valor is not None else "Valor no disponible"

        # --- 2.4) Construir la pregunta automática, incluyendo cultivo_parcela si existe ---
        if cultivo_parcela:
            pregunta_automatica = (
                PROMPT_BASE +
                f"Cultivo: {cultivo_parcela}. Recomendaciones para la parcela '{parcela_full}' "
                f"basadas en el sensor '{sensor}'. Última lectura: {texto_lectura}. "
                f"Dame consejos prácticos para optimizar el cultivo o corregir problemas."
            )
        else:
            pregunta_automatica = (
                PROMPT_BASE +
                f"Recomendaciones para la parcela '{parcela_full}' basadas en el sensor '{sensor}'. "
                f"Última lectura: {texto_lectura}. "
                f"Dame consejos prácticos para optimizar el cultivo o corregir problemas."
            )

        # Si es chat nuevo, generamos chat_id
        if not chat_id:
            chat_id = str(ObjectId())

        # --- 2.5) Construir todos los mensajes previos + prompt_nuevo ---
        mensajes_para_ia = _construir_mensajes_desde_historial(chat_id, prompt_nuevo=pregunta_automatica)

        # Insertamos la "pregunta automática" en MongoDB (respuesta=None por ahora)
        conversaciones_collection.insert_one({
            "chat_id": chat_id,
            "nombre_chat": nombre_chat,
            "pregunta": pregunta_automatica,
            "respuesta": None,
            "timestamp": ahora
        })

        # Preparar headers y body para OpenRouter usando el prompt automático
        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json"
        }
        body = {
            "model": OPENROUTER_MODEL,
            "messages": mensajes_para_ia
        }

        try:
            respuesta = requests.post(
                OPENROUTER_API_URL,
                json=body,
                headers=headers,
                timeout=30
            )
            respuesta.raise_for_status()
            data_ia = respuesta.json()
            texto_ia = data_ia["choices"][0]["message"]["content"].strip()
        except Exception as e:
            traceback.print_exc()
            return jsonify({
                "error": "Fallo al llamar a la API de OpenRouter",
                "detalle": str(e)
            }), 502

        # Actualizamos la misma fila con la respuesta de IA
        conversaciones_collection.update_one(
            {"chat_id": chat_id, "pregunta": pregunta_automatica, "respuesta": None},
            {"$set": {"respuesta": texto_ia, "timestamp": datetime.utcnow()}}
        )

        return jsonify({"chat_id": chat_id, "respuesta": texto_ia}), 200

    # ----------------------------------  
    # 3) Si tipo_peticion no coincide  
    # ----------------------------------  
    else:
        return jsonify({"error": f"Tipo de petición '{tipo_peticion}' no reconocido."}), 400


# ---------------------------------------------------------------------  
# RUTAS ADICIONALES PARA GESTIÓN DE CHATS  
# ---------------------------------------------------------------------  

@chat_ia_blueprint.route("/historial_chats", methods=["GET"])
def listar_chats():
    """
    Devuelve la lista de IDs y nombres de todos los chats (agrupados por chat_id).
    """
    pipeline = [
        {
            "$group": {
                "_id": "$chat_id",
                "last_fecha": {"$max": "$timestamp"},
                "nombre_chat": {"$first": "$nombre_chat"}
            }
        },
        {"$sort": {"last_fecha": -1}}
    ]
    resultados = conversaciones_collection.aggregate(pipeline)
    lista = []
    for doc in resultados:
        lista.append({
            "chat_id": doc["_id"],
            "nombre_chat": doc.get("nombre_chat", "")
        })
    return jsonify(lista), 200


@chat_ia_blueprint.route("/historial/<chat_id>", methods=["GET"])
def obtener_historial(chat_id):
    """
    Recupera todos los mensajes (pregunta y respuesta) de un chat ordenados por fecha.
    """
    cursor = conversaciones_collection.find({"chat_id": chat_id}).sort("timestamp", 1)
    historial = []
    for doc in cursor:
        historial.append({
            "pregunta": doc.get("pregunta", ""),
            "respuesta": doc.get("respuesta", ""),
            "timestamp": doc.get("timestamp")
        })
    return jsonify(historial), 200


@chat_ia_blueprint.route("/crear_chat", methods=["POST"])
def crear_chat():
    """
    Crea un nuevo chat vacío. Devuelve el chat_id generado.
    """
    chat_id = str(ObjectId())
    return jsonify({"chat_id": chat_id}), 200


@chat_ia_blueprint.route("/renombrar_chat/<chat_id>", methods=["PATCH"])
def renombrar_chat(chat_id):
    """
    Cambia el nombre de un chat (actualiza todos los documentos de ese chat_id).
    """
    data = request.get_json(force=True)
    nuevo_nombre = data.get("nombre_chat", "").strip()
    if not nuevo_nombre:
        return jsonify({"error": "El campo 'nombre_chat' es obligatorio."}), 400

    conversaciones_collection.update_many(
        {"chat_id": chat_id},
        {"$set": {"nombre_chat": nuevo_nombre}}
    )
    return jsonify({"chat_id": chat_id, "nombre_chat": nuevo_nombre}), 200


@chat_ia_blueprint.route("/eliminar_chat/<chat_id>", methods=["DELETE"])
def eliminar_chat(chat_id):
    """
    Elimina todos los documentos asociados a un chat_id.
    """
    conversaciones_collection.delete_many({"chat_id": chat_id})
    return jsonify({"message": f"Chat {chat_id} eliminado."}), 200


@chat_ia_blueprint.route("/ultimo_sensor", methods=["GET"])
def ultimo_sensor():
    """
    Recibe:
      ?parcela=<string>
      &tipo=<string>   (por ejemplo: "Temperatura Ambiente" o "Humedad del suelo")
    Retorna el documento JSON con el valor más reciente de ese sensor en la parcela.
    """
    parcela = request.args.get("parcela", "").strip()
    tipo = request.args.get("tipo", "").strip()
    if not parcela or not tipo:
        return jsonify({"error": "Faltan parámetros 'parcela' o 'tipo'"}), 400

    # Buscamos la última lectura para esa parcela y tipo:
    cursor = sensores_collection.find(
        {"parcela": parcela, "tipo": tipo}
    ).sort("timestamp", -1).limit(1)

    docs = list(cursor)
    if not docs:
        return jsonify({"error": f"No hay lecturas de '{tipo}' para '{parcela}'"}), 404

    lectura = docs[0]
    # Dependiendo de “tipo”, extraemos el campo apropiado:
    if tipo.lower() == "temperatura ambiente":
        valor = lectura.get("temperatura", None)
    elif tipo.lower() == "humedad del suelo":
        valor = lectura.get("humedad_suelo", None)
    else:
        # Si deseas otros tipos, por ejemplo “Nivel de pH”:
        campo = tipo.lower().replace(" ", "_")  # “nivel_de_ph” → “ph_suelo”
        valor = lectura.get(campo, None)

    return jsonify({"parcela": parcela, "tipo": tipo, "valor": valor}), 200

@chat_ia_blueprint.route("/recomendaciones/<id_alerta>", methods=["GET"])
def recomendacion_por_alerta(id_alerta):
    """
    Genera una recomendación con IA usando la información detallada de la alerta activa.
    """
    from bson import ObjectId

    alertas_collection = db["alertas_activas"]

    try:
        alerta = alertas_collection.find_one({"_id": ObjectId(id_alerta)})
        if not alerta:
            return jsonify({"error": "No se encontró la alerta"}), 404

        # Extraer campos relevantes
        nombre = alerta.get("nombre_alerta", "")
        descripcion = alerta.get("descripcion", "")
        parcela = alerta.get("parcela", "")
        sensor = alerta.get("sensor", "")
        nutriente = alerta.get("sensor_nutriente", "")
        valor = alerta.get("valor_detectado", "")
        umbral_bajo = alerta.get("umbral_bajo", "")
        umbral_alto = alerta.get("umbral_alto", "")
        fecha_alerta = alerta.get("timestamp_alerta", "")

        # Construir prompt para IA
        prompt = (
            f"Se ha detectado una alerta activa en un campo agrícola:\n\n"
            f"- Parcela: {parcela}\n"
            f"- Tipo de sensor: {sensor}\n"
            f"- Nutriente afectado: {nutriente}\n"
            f"- Valor detectado: {valor}\n"
            f"- Umbral aceptable: entre {umbral_bajo} y {umbral_alto}\n"
            f"- Descripción técnica: {descripcion}\n"
            f"- Fecha de detección: {fecha_alerta}\n\n"
            f"Eres un asesor agrícola experto. Explica brevemente la causa posible del problema, "
            f"su impacto potencial en el cultivo y ofrece una recomendación técnica para resolverlo."
        )

        mensajes = [
            {"role": "system", "content": "Eres un asistente agrónomo experto en nutrición vegetal y manejo de cultivos."},
            {"role": "user", "content": prompt}
        ]

        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json"
        }
        body = {
            "model": OPENROUTER_MODEL,
            "messages": mensajes
        }

        respuesta = requests.post(OPENROUTER_API_URL, json=body, headers=headers, timeout=30)
        respuesta.raise_for_status()
        texto_ia = respuesta.json()["choices"][0]["message"]["content"].strip()

        return jsonify({"recomendacion": texto_ia}), 200

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "Fallo al generar recomendación", "detalle": str(e)}), 500

@chat_ia_blueprint.route("/parcelas_usuario_ia", methods=["GET"])
def parcelas_usuario_ia():
    correo = request.args.get("correo")
    if not correo:
        return jsonify({"error": "Correo requerido"}), 400
    # Busca parcelas donde el usuario esté en el array 'usuario'
    cursor = db["datos_parcelas"].find({"usuario": correo})
    lista = []
    for p in cursor:
        nombre = p.get("nombre", "")
        numero = p.get("numero", "")
        lista.append({
            "displayName": f"{nombre} - Parcela {numero}",
            "nombre": nombre,
            "numero": numero
        })
    return jsonify(lista), 200

@chat_ia_blueprint.route("/analisis-riego", methods=["GET"])
def analisis_riego():
    try:
        lat = request.args.get("lat")
        lon = request.args.get("lon")
        cultivo = request.args.get("cultivo")

        # Validación de parámetros
        if not lat or not lon or not cultivo:
            return jsonify({"error": "Faltan parámetros: 'lat', 'lon' y/o 'cultivo'"}), 400

        print(f"📍 Recibido: lat={lat}, lon={lon}, cultivo={cultivo}")

        # Llamada a OpenWeatherMap
        url_owm = f"https://api.openweathermap.org/data/2.5/forecast?lat={lat}&lon={lon}&appid={OWM_API_KEY}&units=metric&lang=es"
        response_owm = requests.get(url_owm)


        
        if response_owm.status_code != 200:
            return jsonify({"error": "Error al obtener datos de OpenWeatherMap"}), 502

        datos_owm = response_owm.json()
        forecast = datos_owm.get("list", [])[:8]  # solo las próximas 24 horas

        if not forecast:
            return jsonify({"error": "No se recibieron datos de pronóstico"}), 500

        resumen = []
        for bloque in forecast:
            resumen.append({
                "hora": bloque.get("dt_txt"),
                "temperatura": bloque["main"]["temp"],
                "humedad": bloque["main"]["humidity"],
                "nubes": bloque["clouds"]["all"],
                "viento": bloque["wind"]["speed"]
            })

        lluvia_detectada = False
        for bloque in forecast:
            if "rain" in bloque and bloque["rain"].get("3h", 0) > 0:
                lluvia_detectada = True
                break

        if lluvia_detectada:
            prompt = (
                "⚠️ Se detectó lluvia en el pronóstico. "
                "Toma eso en cuenta y recomienda si es mejor no regar o posponer el riego.\n\n"
            )

        # Prompt para IA
        prompt += (
            f"Soy un agricultor que cultiva {cultivo}. "
            "A continuación te entrego datos climáticos por hora para hoy. "
            "Dime breve y consciso cual es la mejor hora para regar y por qué, considerando temperatura, humedad, nubosidad y viento.\n"
        )

        prompt += f"{json.dumps(resumen, indent=2)}"

        # Llamada a OpenRouterAI
        response_ai = requests.post(
            OPENROUTER_API_URL,
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": OPENROUTER_MODEL,
                "messages": [
                    {"role": "system", "content": "Eres un asesor agrícola experto en riego de cultivos."},
                    {"role": "user", "content": prompt}
                ]
            }
        )

        result = response_ai.json()
        recomendacion = result["choices"][0]["message"]["content"]

        return jsonify({
            "grafico": resumen,
            "recomendacion": recomendacion
        })

    except Exception as e:
        print("❌ Error interno en análisis de riego:", e)
        return jsonify({"error": "Error interno del servidor"}), 500
    
# ---------------------------------------------------
@chat_ia_blueprint.route("/valor-ideal", methods=["POST"])
def obtener_valor_ideal():
    try:
        data = request.get_json(force=True)
        parcela = data.get("parcela", "").strip()
        sensor = data.get("sensor", "").strip()

        if not parcela or not sensor:
            return jsonify({"error": "Debes proporcionar 'parcela' y 'sensor'"}), 400

        if " - Parcela " not in parcela:
            return jsonify({"error": "Formato de parcela inválido"}), 400

        nombre, num = parcela.split(" - Parcela ")
        try:
            numero = int(num)
        except ValueError:
            return jsonify({"error": "Número de parcela inválido"}), 400

        doc = db["datos_parcelas"].find_one({"nombre": nombre, "numero": numero})
        if not doc or "cultivo" not in doc:
            return jsonify({"error": "No se encontró cultivo asociado a la parcela"}), 404

        cultivo = doc["cultivo"]

        # Prompt especial para nutrientes
        if sensor.lower() == "nivel de nutrientes":
            prompt = (
                f"Eres un asesor agrícola experto. Para un cultivo de '{cultivo}', "
                f"indica los valores ideales de nitrógeno, fósforo y potasio como números separados. "
                f"Responde solo en este formato exacto: N: [número], P: [número], K: [número]. "
                f"No agregues explicaciones."
            )
        else:
            prompt = (
                f"Eres un asesor agrícola experto. Para un cultivo de '{cultivo}', "
                f"indica el valor ideal del sensor '{sensor}' como un número exacto (sin texto). "
                f"Por ejemplo: 23.5 o 6.8. No expliques nada, solo devuelve el número ideal."
            )

        mensajes = [
            {"role": "system", "content": "Eres un asesor agrícola que responde con precisión en formato numérico."},
            {"role": "user", "content": prompt}
        ]

        headers = {
            "Authorization": f"Bearer {os.getenv('OPENROUTER_API_KEY')}",
            "Content-Type": "application/json"
        }

        body = {
            "model": os.getenv("OPENROUTER_MODEL"),
            "messages": mensajes
        }

        response = requests.post(os.getenv("OPENROUTER_API_URL"), json=body, headers=headers, timeout=30)
        response.raise_for_status()
        texto_ia = response.json()["choices"][0]["message"]["content"].strip()

        # Si es nutrientes, parsear tres valores
        if sensor.lower() == "nivel de nutrientes":
            import re
            match = re.search(r"N:\s*(\d+(?:\.\d+)?),\s*P:\s*(\d+(?:\.\d+)?),\s*K:\s*(\d+(?:\.\d+)?)", texto_ia)
            if match:
                return jsonify({
                    "sensor": sensor,
                    "cultivo": cultivo,
                    "n": float(match.group(1)),
                    "p": float(match.group(2)),
                    "k": float(match.group(3))
                }), 200
            else:
                print("❌ La IA no devolvió NPK válido:", texto_ia)
                return jsonify({"error": "Formato incorrecto", "respuesta_cruda": texto_ia}), 500

        # Caso normal (valor único)
        try:
            valor_ideal = float(texto_ia)
        except ValueError:
            print("❌ La IA no devolvió un número válido:", texto_ia)
            return jsonify({"error": "La IA no devolvió un número válido", "respuesta_cruda": texto_ia}), 500

        return jsonify({
            "cultivo": cultivo,
            "sensor": sensor,
            "valor_ideal": valor_ideal
        }), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(" Prompt enviado a IA:", prompt if 'prompt' in locals() else "N/A")
        print(" Respuesta cruda IA:", texto_ia if 'texto_ia' in locals() else "N/A")
        return jsonify({"error": "Fallo al obtener valor ideal", "detalle": str(e)}), 500

