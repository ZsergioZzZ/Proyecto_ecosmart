from flask import Blueprint, request, jsonify

from pymongo import MongoClient
from dotenv import load_dotenv
import os


agregar_sensores_blueprint = Blueprint('agregar_sensores', __name__)

# Cargar variables de entorno

load_dotenv()

# Configurar MongoDB
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME")
COLLECTION_SENSORES = os.getenv("COLLECTION_SENSORES", "sensores")

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
sensores = db[COLLECTION_SENSORES]
parcelas = db["datos_parcelas"]  

# -------------------------------
@agregar_sensores_blueprint.route("/api/sensores", methods=["POST"])
def guardar_sensor():
    data = request.json

    # Valida campos obligatorios
    campos = ["parcela", "tipo", "ubicacion"]
    if not all(c in data for c in campos):
        return jsonify({"error": "Faltan campos obligatorios"}), 400

    if not data["parcela"].strip() or not data["tipo"].strip():
        return jsonify({"error": "Todos los campos deben tener valores válidos"}), 400

    if not isinstance(data["ubicacion"], dict) or "lat" not in data["ubicacion"] or "lng" not in data["ubicacion"]:
        return jsonify({"error": "Ubicación inválida"}), 400

    # Valida que no exista otro sensor con mismo número, tipo y parcela
    existe = sensores.find_one({
        "parcela": data["parcela"],
        "tipo": data["tipo"],
    })

    if existe:
        return jsonify({"error": "Ya existe un sensor con ese número en esta parcela"}), 400

    sensores.insert_one({
        "parcela": data["parcela"],
        "tipo": data["tipo"],
        "ubicacion": {
            "lat": data["ubicacion"]["lat"],
            "lng": data["ubicacion"]["lng"]
        }
    })

    return jsonify({"mensaje": "Sensor guardado exitosamente"}), 201

@agregar_sensores_blueprint.route("/api/parcela_ag_sensores", methods=["GET"])
def obtener_parcela():
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

@agregar_sensores_blueprint.route("/api/sensores-list", methods=["GET"])
def listar_sensores():
    lista = list(sensores.find({}, {"_id": 0, "parcela": 1, "tipo": 1, "numero": 1}))
    return jsonify(lista), 200

# -------------------------------
# GET /api/parcelas
@agregar_sensores_blueprint.route("/api/parcelas_ag_sensores", methods=["GET"])
def obtener_parcelas():
    resultado = parcelas.find({}, {"_id": 0, "nombre": 1, "numero": 1})
    lista = list(resultado)
    return jsonify(lista), 200

