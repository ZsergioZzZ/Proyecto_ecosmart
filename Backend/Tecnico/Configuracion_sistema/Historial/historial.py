from flask import Blueprint, request, jsonify
from pymongo import MongoClient
from dotenv import load_dotenv
import os



historial_tecnico_blueprint = Blueprint('historial', __name__)

# Configuración inicial
load_dotenv()


client = MongoClient(os.getenv("MONGO_URI"))
db = client[os.getenv("DB_NAME")]
parcelas = db["datos_parcelas"]
sensores = db["sensores"]

@historial_tecnico_blueprint.route("/api/parcelas-detalle", methods=["GET"])
def obtener_parcelas_completas():
    correo = request.args.get("correo")
    if not correo:
        return jsonify({"error": "Falta el correo"}), 400
    resultado = parcelas.find({"usuario": correo}, {"_id": 0})
    return jsonify(list(resultado)), 200


# Obtener sensores asociados a una parcela
@historial_tecnico_blueprint.route("/api/sensores-por-parcela", methods=["GET"])
def sensores_por_parcela():
    nombre = request.args.get("parcela")
    if not nombre:
        return jsonify({"error": "Parámetro 'parcela' requerido"}), 400

    sensores_lista = sensores.find({"parcela": nombre}, {"_id": 0})
    return jsonify(list(sensores_lista)), 200

# Obtener puntos de una parcela específica
@historial_tecnico_blueprint.route("/parcela", methods=["GET"])
def obtener_parcela_historial():
    nombre = request.args.get("nombre")
    numero = request.args.get("numero")

    if not nombre or not numero:
        return jsonify({"error": "Faltan parámetros"}), 400

    try:
        numero = int(numero)
    except ValueError:
        return jsonify({"error": "Número inválido"}), 400

    parcela = parcelas.find_one(
        {"nombre": nombre, "numero": numero},
        {"_id": 0, "puntos": 1}
    )

    if not parcela:
        return jsonify({"error": "Parcela no encontrada"}), 404

    return jsonify(parcela), 200
