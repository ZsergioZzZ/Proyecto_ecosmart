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
parcelas = db[os.getenv("COLLECTION_PARCELAS", "datos_parcelas")]
sensores = db[os.getenv("COLLECTION_SENSORES", "sensores")]

# Ruta para obtener lista de parcelas
@configurar_umbrales_alerta_blueprint.route("/configuracion-alertas/parcelas", methods=["GET"])
def obtener_parcelas_para_alerta():
    resultado = list(parcelas.find({}, {"_id": 0, "nombre": 1, "numero": 1}))
    return jsonify(resultado), 200

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

    # Validar correo si viene
    if "correo" in data["notificaciones"]:
        correo = data.get("correo", "").strip()
    else:
        correo = None


    if "app" in data["notificaciones"]:
        correo_app = data.get("correo_app", "").strip()
    else:
        correo_app = None


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