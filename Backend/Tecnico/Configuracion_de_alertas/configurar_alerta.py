from flask import Blueprint, request, jsonify
from pymongo import MongoClient
from dotenv import load_dotenv
import os
import re

# Cargar variables de entorno
load_dotenv()

# Inicializar Blueprint
configurar_umbrales_alerta_blueprint = Blueprint('configurar_umbrales_alerta', __name__)

# Conexión a MongoDB
client = MongoClient(os.getenv("MONGO_URI"))
db = client[os.getenv("DB_NAME")]

# Colecciones
alertas = db[os.getenv("COLLECTION_ALERTAS", "alertas")]
alertas_activas = db["alertas_activas"]
parcelas = db[os.getenv("COLLECTION_PARCELAS", "datos_parcelas")]
sensores = db[os.getenv("COLLECTION_SENSORES", "sensores")]

# Ruta para obtener sensores asociados a una parcela
@configurar_umbrales_alerta_blueprint.route("/configuracion-alertas/sensores", methods=["GET"])
def obtener_sensores_por_parcela():
    nombre_parcela = request.args.get("parcela")
    if not nombre_parcela:
        return jsonify({"error": "Debe indicar una parcela"}), 400

    resultado = list(sensores.find({"parcela": nombre_parcela}, {"_id": 1, "tipo": 1}))
    for sensor in resultado:
        sensor["_id"] = str(sensor["_id"])
    return jsonify(resultado), 200

# Ruta para crear una nueva alerta
@configurar_umbrales_alerta_blueprint.route("/configuracion-alertas/nueva", methods=["POST"])
def crear_alerta():
    data = request.json

    campos_comunes = ["nombre_alerta", "parcela", "sensor", "notificaciones"]
    if not all(campo in data for campo in campos_comunes):
        return jsonify({"error": "Faltan campos requeridos"}), 400

    if not isinstance(data["notificaciones"], list):
        return jsonify({"error": "El campo 'notificaciones' debe ser una lista"}), 400

    correo_raw = data.get("correo", [])
    correo = [correo_raw] if isinstance(correo_raw, str) and correo_raw else list(correo_raw) if isinstance(correo_raw, list) else []

    correo_app_raw = data.get("correo_app", [])
    correo_app = [correo_app_raw] if isinstance(correo_app_raw, str) and correo_app_raw else list(correo_app_raw) if isinstance(correo_app_raw, list) else []

    # Verificar duplicado por nombre + parcela + sensor
    existe = alertas.find_one({
        "nombre_alerta": data["nombre_alerta"],
        "parcela": data["parcela"],
        "sensor": data["sensor"].lower().strip()
    })
    if existe:
        return jsonify({"error": "Ya existe una alerta con ese nombre en esta parcela y sensor"}), 409

    sensor = data["sensor"].strip().lower()

    if "nutriente" in sensor:
        nutrientes_requeridos = [
            "n_alto", "n_desc_alto", "n_bajo", "n_desc_bajo",
            "p_alto", "p_desc_alto", "p_bajo", "p_desc_bajo",
            "k_alto", "k_desc_alto", "k_bajo", "k_desc_bajo"
        ]
        if not all(campo in data for campo in nutrientes_requeridos):
            return jsonify({"error": "Faltan campos de nutrientes"}), 400

        nueva_alerta = {
            "nombre_alerta": data["nombre_alerta"],
            "parcela": data["parcela"],
            "sensor": data["sensor"],
            "notificaciones": data["notificaciones"],
            "correo": correo,
            "correo_app": correo_app,
            "nutrientes": {
                "n": {
                    "umbral_alto": data["n_alto"],
                    "descripcion_alto": data["n_desc_alto"],
                    "umbral_bajo": data["n_bajo"],
                    "descripcion_bajo": data["n_desc_bajo"]
                },
                "p": {
                    "umbral_alto": data["p_alto"],
                    "descripcion_alto": data["p_desc_alto"],
                    "umbral_bajo": data["p_bajo"],
                    "descripcion_bajo": data["p_desc_bajo"]
                },
                "k": {
                    "umbral_alto": data["k_alto"],
                    "descripcion_alto": data["k_desc_alto"],
                    "umbral_bajo": data["k_bajo"],
                    "descripcion_bajo": data["k_desc_bajo"]
                }
            }
        }

    else:
        normales_requeridos = ["umbral_alto", "descripcion_alto", "umbral_bajo", "descripcion_bajo"]
        if not all(campo in data for campo in normales_requeridos):
            return jsonify({"error": "Faltan campos normales"}), 400

        nueva_alerta = {
            "nombre_alerta": data["nombre_alerta"],
            "parcela": data["parcela"],
            "sensor": data["sensor"],
            "umbral_alto": data["umbral_alto"],
            "descripcion_alto": data["descripcion_alto"],
            "umbral_bajo": data["umbral_bajo"],
            "descripcion_bajo": data["descripcion_bajo"],
            "notificaciones": data["notificaciones"],
            "correo": correo,
            "correo_app": correo_app
        }

    resultado = alertas.insert_one(nueva_alerta)

    return jsonify({
        "mensaje": "Alerta guardada correctamente",
        "id": str(resultado.inserted_id)
    }), 201


# Ruta para obtener correo del usuario asociado a una parcela
@configurar_umbrales_alerta_blueprint.route("/configuracion-alertas/correo-usuario", methods=["GET"])
def obtener_correo_usuario_por_parcela():
    parcela_nombre = request.args.get("parcela")

    if not parcela_nombre:
        return jsonify({"error": "Parcela no especificada"}), 400

    # Buscar la parcela por nombre completo
    parcela = parcelas.find_one({"$expr": {
        "$eq": [{"$concat": ["$nombre", " - Parcela ", {"$toString": "$numero"}]}, parcela_nombre]
    }})

    if not parcela or "usuario" not in parcela:
        return jsonify({"error": "Usuario no encontrado"}), 404

    # Normaliza para siempre retornar lista
    usuario = parcela["usuario"]
    if isinstance(usuario, str):
        usuario = [usuario]

    return jsonify({"correo": usuario})


## Editar alerta existente
# Ruta para obtener alertas por parcela y sensor
@configurar_umbrales_alerta_blueprint.route("/configuracion-alertas/alertas", methods=["GET"])
def obtener_alertas_por_parcela_y_sensor():
    parcela = request.args.get("parcela")
    sensor = request.args.get("sensor")
    if not parcela or not sensor:
        return jsonify({"error": "Faltan datos"}), 400

    alertas_filtradas = list(alertas.find(
        {"parcela": parcela, "sensor": sensor.lower()},
        {"_id": 1, "nombre_alerta": 1}
    ))

    for alerta in alertas_filtradas:
        alerta["_id"] = str(alerta["_id"])
    return jsonify(alertas_filtradas), 200



# Ruta para obtener datos completos de una alerta específica
@configurar_umbrales_alerta_blueprint.route("/configuracion-alertas/detalle")
def obtener_detalle_alerta():
    nombre = request.args.get("nombre_alerta")
    parcela = request.args.get("parcela")
    sensor = request.args.get("sensor")

    if not nombre or not parcela or not sensor:
        return jsonify({"error": "Faltan parámetros"}), 400

    alerta = alertas.find_one({
        "nombre_alerta": nombre,
        "parcela": parcela,
        "sensor": sensor.lower().strip()
    })

    if not alerta:
        return jsonify({"error": "Alerta no encontrada"}), 404

    resultado = {
        "nombre_alerta": alerta["nombre_alerta"],
        "sensor": alerta["sensor"],
        "notificaciones": alerta.get("notificaciones", []),
        "correo": alerta.get("correo", []) if isinstance(alerta.get("correo", []), list) else [alerta.get("correo", "")],
        "correo_app": alerta.get("correo_app", []) if isinstance(alerta.get("correo_app", []), list) else [alerta.get("correo_app", "")]
    }

    if alerta["sensor"].lower().strip() == "nivel de nutrientes":
        resultado["nutrientes"] = alerta.get("nutrientes", {})
    else:
        resultado.update({
            "umbral_alto": alerta.get("umbral_alto"),
            "descripcion_alto": alerta.get("descripcion_alto", ""),
            "umbral_bajo": alerta.get("umbral_bajo"),
            "descripcion_bajo": alerta.get("descripcion_bajo", "")
        })

    return jsonify(resultado)



# Ruta para actualizar alerta existente
@configurar_umbrales_alerta_blueprint.route("/configuracion-alertas/modificar", methods=["POST"])
def modificar_alerta():
    data = request.json
    nombre_original = request.args.get("original")

    parcela = data.get("parcela")
    sensor = data.get("sensor")

    if not nombre_original or not parcela or not sensor:
        return jsonify({"error": "Faltan datos para identificar la alerta"}), 400

    data.pop("_id", None)

    # Eliminar todas las instancias activas relacionadas con esta alerta antes de modificar
    alertas_activas.delete_many({
        "nombre_alerta": nombre_original,
        "parcela": parcela
    })

    resultado = alertas.update_one({
        "nombre_alerta": nombre_original,
        "parcela": parcela,
        "sensor": sensor.strip().lower()
    }, {"$set": data})

    if resultado.matched_count == 0:
        return jsonify({"error": "Alerta no encontrada"}), 404

    return jsonify({"mensaje": "Alerta actualizada correctamente"}), 200


@configurar_umbrales_alerta_blueprint.route("/configuracion-alertas/eliminar", methods=["DELETE"])
def eliminar_alerta():
    nombre_alerta = request.args.get("nombre_alerta")
    parcela = request.args.get("parcela")
    sensor = request.args.get("sensor")

    if not nombre_alerta or not parcela or not sensor:
        return jsonify({"error": "Faltan datos para eliminar la alerta"}), 400

    # Eliminar la alerta principal
    resultado = alertas.delete_one({
        "nombre_alerta": nombre_alerta,
        "parcela": parcela,
        "sensor": sensor.strip().lower()
    })

    # Eliminar todas las activaciones de esta alerta en la colección de alertas activas
    alertas_activas.delete_many({
        "nombre_alerta": nombre_alerta,
        "parcela": parcela
    })

    if resultado.deleted_count == 0:
        return jsonify({"error": "La alerta no fue encontrada"}), 404

    return jsonify({"mensaje": "Alerta eliminada correctamente"}), 200



@configurar_umbrales_alerta_blueprint.route("/configuracion-alertas/historial", methods=["GET"])
def historial_alertas():
    correo = request.args.get("correo")

    if correo:
        # 1. Buscar parcelas asociadas al correo (ya sea en array o string por compatibilidad)
        parcelas_usuario = list(parcelas.find(
            {"usuario": correo},
            {"_id": 0, "nombre": 1, "numero": 1}
        ))
        nombres_parcelas = [f"{p['nombre']} - Parcela {p['numero']}" for p in parcelas_usuario]
        # 2. Filtrar solo esas alertas
        filtro_alertas = {"parcela": {"$in": nombres_parcelas}}
    else:
        # Si no se pasa correo, trae todas las alertas (comportamiento antiguo)
        filtro_alertas = {}

    todas = list(alertas.find(filtro_alertas, {"_id": 0}))
    activas = list(alertas_activas.find(filtro_alertas, {
        "_id": 0,
        "nombre_alerta": 1,
        "parcela": 1,
        "estado": 1
    }))
    set_activas = {
        (a["nombre_alerta"], a["parcela"])
        for a in activas if a.get("estado") == "Activa"
    }

    resultado = []

    for alerta in todas:
        nombre_alerta = alerta.get("nombre_alerta")
        parcela_nombre = alerta.get("parcela")
        if (nombre_alerta, parcela_nombre) in set_activas:
            alerta["estado"] = "Alerta activa"

        parcela_doc = parcelas.find_one({
            "$expr": {
                "$eq": [
                    {"$concat": ["$nombre", " - Parcela ", {"$toString": "$numero"}]},
                    parcela_nombre
                ]
            }
        })
        usuario = parcela_doc.get("usuario", []) if parcela_doc else []
        if isinstance(usuario, str):
            usuario = [usuario]
        alerta["usuario"] = usuario if usuario else ["No asignado"]

        resultado.append({
            "nombre_alerta": nombre_alerta,
            "parcela": parcela_nombre,
            "sensor": alerta.get("sensor"),
            "usuario": alerta["usuario"],
            "notificaciones": alerta.get("notificaciones", []),
            "correo": alerta.get("correo", []),
            "correo_app": alerta.get("correo_app", []),
            "umbral_alto": alerta.get("umbral_alto"),
            "descripcion_alto": alerta.get("descripcion_alto"),
            "umbral_bajo": alerta.get("umbral_bajo"),
            "descripcion_bajo": alerta.get("descripcion_bajo"),
            "nutrientes": alerta.get("nutrientes", {}),
            **({"estado": "Alerta activa"} if "estado" in alerta else {})
        })

    return jsonify(resultado), 200


@configurar_umbrales_alerta_blueprint.route("/configuracion-alertas/parcelas-usuario", methods=["GET"])
def obtener_parcelas_usuario():
    correo = request.args.get("correo")
    if not correo:
        return jsonify({"error": "Falta correo"}), 400
    # Busca parcelas donde el usuario esté en el array "usuario"
    resultado = list(parcelas.find(
        {"usuario": correo},   # <-- busca en array, o string legacy
        {"_id": 0, "nombre": 1, "numero": 1}
    ))
    return jsonify(resultado), 200


