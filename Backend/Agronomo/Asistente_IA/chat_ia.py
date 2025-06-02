# chat_ia.py

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
            prompt_nuevo = f"(Cultivo: {cultivo_usuario}) {pregunta_usuario}"
        else:
            prompt_nuevo = pregunta_usuario

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
    elif tipo_peticion == "sensor":
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
                f"(Cultivo: {cultivo_parcela}) Recomendaciones para la parcela '{parcela_full}' "
                f"basadas en el sensor '{sensor}'. Última lectura: {texto_lectura}. "
                f"Dame consejos prácticos para optimizar el cultivo o corregir problemas."
            )
        else:
            pregunta_automatica = (
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
