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

PROMPT_BASE = (
    "Eres un asistente experto en el área de la agricultura. "
    "Tu función es exclusivamente responder preguntas relacionadas con prácticas agrícolas, "
    "cultivos, suelo, clima agrícola, enfermedades de plantas, nutrición vegetal, etc. "
    "Si te hacen una pregunta fuera de ese ámbito, responde amablemente que solo puedes hablar de agricultura.\n\n"
)

# ==============================================================  
# FUNCIÓN AUXILIAR: Recuperar historial completo de un chat_id  
# ==============================================================  
def _construir_mensajes_desde_historial(user_email, chat_id, prompt_nuevo=None):
    mensajes = [
        {"role": "system", "content": PROMPT_BASE}
    ]
    filtro = {"user_email": user_email, "chat_id": chat_id}
    cursor = conversaciones_collection.find(filtro).sort("timestamp", 1)

    for doc in cursor:
        pregunta  = (doc.get("pregunta")  or "").strip()
        respuesta = (doc.get("respuesta") or "").strip()

        if pregunta:
            mensajes.append({"role": "user",      "content": pregunta})
        if respuesta:
            mensajes.append({"role": "assistant", "content": respuesta})

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
        "Si te hacen una pregunta fuera de ese ámbito, responde amablemente que solo puedes hablar de agricultura.\n\n"
    )

    data        = request.get_json(force=True)
    user_email  = data.get("email",    "").strip()
    chat_id     = data.get("chat_id", None)
    nombre_chat = data.get("nombre_chat", "")
    tipo        = data.get("tipo_peticion", "texto_libre").strip()
    ahora       = datetime.utcnow()

    # ----------------------------------------------------
    # 1) TEXTO LIBRE
    # ----------------------------------------------------
        # ----------------------------------------------------
    # 1) TEXTO LIBRE
    # ----------------------------------------------------
    if tipo == "texto_libre":
        # 1.1) Leer y validar pregunta y cultivo opcional
        pregunta_usuario = data.get("pregunta", "").strip()
        cultivo_usuario  = data.get("cultivo",  "").strip()
        if not pregunta_usuario:
            return jsonify({"error": "El campo 'pregunta' es obligatorio."}), 400

        # 1.2) Generar chat_id si es un chat nuevo
        if not chat_id:
            chat_id = str(ObjectId())

        # 1.3) Construir la "pregunta limpia" que verá el usuario y se guardará
        if cultivo_usuario:
            pregunta_para_usuario = f"Cultivo: {cultivo_usuario}. {pregunta_usuario}"
        else:
            pregunta_para_usuario = pregunta_usuario

        # 1.4) El prompt que vamos a enviar a la IA es exactamente esa pregunta limpia
        prompt_nuevo = pregunta_para_usuario

        # 1.5) Construir todo el historial + este prompt
        mensajes_para_ia = _construir_mensajes_desde_historial(
            user_email, 
            chat_id, 
            prompt_nuevo=prompt_nuevo
        )

        # 1.6) Guardar en MongoDB **solo** la pregunta limpia
        conversaciones_collection.insert_one({
            "user_email":  user_email,
            "chat_id":     chat_id,
            "nombre_chat": nombre_chat,
            "pregunta":    pregunta_para_usuario,
            "respuesta":   None,
            "timestamp":   ahora
        })

        # 1.7) Llamar a OpenRouter
        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type":  "application/json"
        }
        body = {
            "model":    OPENROUTER_MODEL,
            "messages": mensajes_para_ia
        }
        try:
            resp     = requests.post(OPENROUTER_API_URL, json=body, headers=headers, timeout=30)
            resp.raise_for_status()
            texto_ia = resp.json()["choices"][0]["message"]["content"].strip()
        except Exception as e:
            traceback.print_exc()
            return jsonify({
                "error":  "Fallo al llamar a la API de OpenRouter",
                "detalle": str(e)
            }), 502

        # 1.8) Actualizar el mismo documento con la respuesta de la IA
        conversaciones_collection.update_one(
            {
                "user_email": user_email,
                "chat_id":    chat_id,
                "pregunta":   pregunta_para_usuario,
                "respuesta":  None
            },
            {
                "$set": {
                    "respuesta": texto_ia,
                    "timestamp": datetime.utcnow()
                }
            }
        )

        # 1.9) Devolver chat_id y respuesta
        return jsonify({"chat_id": chat_id, "respuesta": texto_ia}), 200


        # ----------------------------------------------------
    # 2) SENSOR
    # ----------------------------------------------------
    if tipo == "sensor":
        # 2.1) Leer y validar parámetros
        parcela_full = data.get("parcela", "").strip()
        sensor       = data.get("sensor",  "").strip()
        if not parcela_full or not sensor:
            return jsonify({"error": "Los campos 'parcela' y 'sensor' son obligatorios."}), 400

        # 2.2) Extraer cultivo de la parcela
        cultivo_parcela = ""
        try:
            if " - Parcela " in parcela_full:
                base, num = parcela_full.split(" - Parcela ")
                doc_par = parcelas_collection.find_one({
                    "nombre": base,
                    "numero": int(num)
                })
                cultivo_parcela = doc_par.get("cultivo", "") if doc_par else ""
        except:
            cultivo_parcela = ""

        # 2.3) Obtener la última lectura
        docs = list(
            sensores_collection
              .find({"parcela": parcela_full, "tipo": sensor})
              .sort("timestamp", -1)
              .limit(1)
        )
        if not docs:
            return jsonify({
                "error": f"No hay lecturas de '{sensor}' en '{parcela_full}'."
            }), 404
        lectura = docs[0]

        # 2.4) Formatear el texto de la lectura
        campo = sensor.lower().replace(" ", "_")
        if sensor.lower() == "temperatura ambiente":
            valor = lectura.get("temperatura")
            texto_lectura = f"Temperatura Ambiente: {valor} °C"
        elif sensor.lower() == "nivel de ph":
            valor = lectura.get("ph_suelo")
            texto_lectura = f"Nivel de pH: {valor}"
        elif sensor.lower() == "humedad del suelo":
            valor = lectura.get("humedad_suelo")
            texto_lectura = f"Humedad del suelo: {valor} %"
        elif sensor.lower() == "nivel de nutrientes":
            nutr = lectura.get("nutrientes", {})
            texto_lectura = (
                f"N:{nutr.get('nitrógeno')}, "
                f"P:{nutr.get('fósforo')}, "
                f"K:{nutr.get('potasio')}"
            )
        else:
            valor = lectura.get(campo)
            texto_lectura = f"{sensor}: {valor}" if valor is not None else "Valor no disponible"

        # 2.5) Construir la “pregunta limpia” para el usuario
        if cultivo_parcela:
            pregunta_para_usuario = (
                f"Cultivo: {cultivo_parcela}. "
                f"Recomendaciones para la parcela '{parcela_full}' basadas en el sensor "
                f"'{sensor}'. Última lectura: {texto_lectura}. "
                "Dame consejos prácticos para optimizar el cultivo o corregir problemas."
            )
        else:
            pregunta_para_usuario = (
                f"Recomendaciones para la parcela '{parcela_full}' basadas en el sensor "
                f"'{sensor}'. Última lectura: {texto_lectura}. "
                "Dame consejos prácticos para optimizar el cultivo o corregir problemas."
            )

        # 2.6) Usar EXACTAMENTE esa pregunta como prompt para la IA
        prompt_nuevo = pregunta_para_usuario

        # 2.7) Construir mensajes (historial + prompt)
        mensajes_para_ia = _construir_mensajes_desde_historial(
            user_email,
            chat_id,
            prompt_nuevo=prompt_nuevo
        )

        # 2.8) Guardar en MongoDB la pregunta limpia
        conversaciones_collection.insert_one({
            "user_email":  user_email,
            "chat_id":     chat_id,
            "nombre_chat": nombre_chat,
            "pregunta":    pregunta_para_usuario,
            "respuesta":   None,
            "timestamp":   ahora
        })

        # 2.9) Llamar a la API de OpenRouter
        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type":  "application/json"
        }
        body = {
            "model":    OPENROUTER_MODEL,
            "messages": mensajes_para_ia
        }
        try:
            resp     = requests.post(
                          OPENROUTER_API_URL,
                          json=body,
                          headers=headers,
                          timeout=30
                      )
            resp.raise_for_status()
            texto_ia = resp.json()["choices"][0]["message"]["content"].strip()
        except Exception as e:
            traceback.print_exc()
            return jsonify({
                "error":  "Fallo al llamar a la API de OpenRouter",
                "detalle": str(e)
            }), 502

        # 2.10) Actualizar el documento con la respuesta
        conversaciones_collection.update_one(
            {
                "user_email": user_email,
                "chat_id":    chat_id,
                "pregunta":   pregunta_para_usuario,
                "respuesta":  None
            },
            {
                "$set": {
                    "respuesta": texto_ia,
                    "timestamp": datetime.utcnow()
                }
            }
        )

        # 2.11) Devolver chat_id y respuesta
        return jsonify({"chat_id": chat_id, "respuesta": texto_ia}), 200


    # ----------------------------------------------------
    # 3) tipo_peticion no reconocido
    # ----------------------------------------------------
    return jsonify({"error": f"Tipo de petición '{tipo}' no reconocido."}), 400

# ---------------------------------------------------------------------  
# RUTAS ADICIONALES PARA GESTIÓN DE CHATS  
# ---------------------------------------------------------------------  

@chat_ia_blueprint.route("/historial_chats", methods=["GET"])
def listar_chats():
    # 1) obtener email de la query
    user_email = request.args.get("email", "").strip()
    if not user_email:
        return jsonify({"error": "El campo 'email' es obligatorio."}), 400

    # 2) pipeline: primero filtrar, luego agrupar y ordenar
    pipeline = [
        {"$match":   {"user_email": user_email}},
        {"$group":   {
            "_id":        "$chat_id",
            "last_fecha": {"$max": "$timestamp"},
            "nombre_chat":{"$first":"$nombre_chat"}
        }},
        {"$sort":    {"last_fecha": -1}}
    ]
    resultados = conversaciones_collection.aggregate(pipeline)

    lista = [
      {"chat_id": doc["_id"], "nombre_chat": doc["nombre_chat"]}
      for doc in resultados
    ]
    return jsonify(lista), 200


@chat_ia_blueprint.route("/historial/<chat_id>", methods=["GET"])
def obtener_historial(chat_id):
    user_email = request.args.get("email", "").strip()
    if not user_email:
        return jsonify({"error": "El campo 'email' es obligatorio."}), 400

    # Ahora sí filtramos por chat_id *y* user_email
    cursor = conversaciones_collection.find(
        {"chat_id": chat_id, "user_email": user_email}
    ).sort("timestamp", 1)

    historial = [
      {
        "pregunta":  doc.get("pregunta", ""),
        "respuesta": doc.get("respuesta", ""),
        "timestamp": doc.get("timestamp")
      }
      for doc in cursor
    ]
    return jsonify(historial), 200


@chat_ia_blueprint.route("/crear_chat", methods=["POST"])
def crear_chat():
    """
    Crea un nuevo chat vacío para el usuario y devuelve el chat_id generado.
    """
    data = request.get_json(force=True)
    user_email  = data.get("email",       "").strip()
    nombre_chat = data.get("nombre_chat","").strip()  # opcional

    if not user_email:
        return jsonify({"error": "Falta el campo 'email'"}), 400

    # 1) Generar nuevo chat_id
    chat_id = str(ObjectId())
    ahora   = datetime.utcnow()

    # 2) Insertar un registro inicial para que el chat aparezca en la lista
    conversaciones_collection.insert_one({
        "user_email":  user_email,
        "chat_id":     chat_id,
        "nombre_chat": nombre_chat,
        "pregunta":    "",
        "respuesta":   "",
        "timestamp":   ahora
    })

    # 3) Devolver el chat_id al frontend
    return jsonify({"chat_id": chat_id}), 200


@chat_ia_blueprint.route("/renombrar_chat/<chat_id>", methods=["PATCH"])
def renombrar_chat(chat_id):
    data       = request.get_json(force=True)
    user_email = data.get("email",       "").strip()
    nuevo_nombre = data.get("nombre_chat","").strip()

    # 1) Validar email
    if not user_email:
        return jsonify({"error": "El campo 'email' es obligatorio."}), 400
    # 2) Validar nuevo nombre
    if not nuevo_nombre:
        return jsonify({"error": "El campo 'nombre_chat' es obligatorio."}), 400

    # 3) Filtrar por chat_id **y** por usuario
    conversaciones_collection.update_many(
        {
        "chat_id":    chat_id,
        "user_email": user_email
        },
        {"$set": {"nombre_chat": nuevo_nombre}}
    )

    return jsonify({"chat_id": chat_id, "nombre_chat": nuevo_nombre}), 200

@chat_ia_blueprint.route("/eliminar_chat/<chat_id>", methods=["DELETE"])
def eliminar_chat(chat_id):
    """
    Elimina todos los documentos asociados a un chat_id para un usuario dado.
    """
    # 1) Leer el email de la query string en lugar del body
    user_email = request.args.get("email", "").strip()
    if not user_email:
        return jsonify({"error": "El campo 'email' es obligatorio."}), 400

    # 2) Borrar únicamente los docs de ese usuario y chat_id
    result = conversaciones_collection.delete_many({
        "chat_id":    chat_id,
        "user_email": user_email
    })

    return jsonify({
        "message":      f"Chat {chat_id} eliminado.",
        "deletedCount": result.deleted_count
    }), 200



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