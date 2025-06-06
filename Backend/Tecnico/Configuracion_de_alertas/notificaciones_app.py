from flask import Blueprint, request, jsonify
from pymongo import MongoClient
from dotenv import load_dotenv
import os
from bson import ObjectId
from bson.errors import InvalidId 

load_dotenv()

notificaciones_blueprint = Blueprint("notificaciones", __name__)
client = MongoClient(os.getenv("MONGO_URI"))
db = client[os.getenv("DB_NAME")]
alertas_activas = db["alertas_activas"]

@notificaciones_blueprint.route("/notificaciones", methods=["GET"])
def obtener_notificaciones_por_usuario():
    try:
        correo = request.args.get("correo")
        if not correo:
            return jsonify({"error": "Falta el correo del usuario"}), 400

        resultado = list(alertas_activas.find({
            "estado": "Activa",
            "correo_app": correo
        }, {
            "_id": 1,
            "nombre_alerta": 1,
            "descripcion": 1,
            "parcela": 1,
            "timestamp_alerta": 1
        }))

        # Convertir _id a str para evitar errores al serializar
        for alerta in resultado:
            alerta["_id"] = str(alerta["_id"])

        return jsonify(resultado), 200

    except Exception as e:
        print(f"❌ Error en /notificaciones: {e}")
        return jsonify({"error": "Error interno del servidor"}), 500



@notificaciones_blueprint.route("/notificaciones/marcar-leida", methods=["POST"])
def marcar_notificacion_leida():
    data = request.json
    id_alerta = data.get("id")

    if not id_alerta:
        return jsonify({"error": "Falta ID de alerta"}), 400

    try:
        object_id = ObjectId(id_alerta)
    except InvalidId:
        return jsonify({"error": "ID inválido"}), 400

    resultado = alertas_activas.update_one(
        {"_id": object_id},
        {"$set": {"estado": "Leída"}}
    )

    if resultado.modified_count == 1:
        return jsonify({"mensaje": "Notificación marcada como leída"}), 200
    else:
        return jsonify({"error": "No se encontró o ya fue actualizada"}), 404