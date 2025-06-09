from flask import Blueprint, jsonify, request
from pymongo import MongoClient
from dotenv import load_dotenv
import os
import re

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME")

# Conexión a MongoDB
client = MongoClient(MONGO_URI)
db = client[DB_NAME]

# Colecciones con nombres por defecto si no están definidos
alertas = db[os.getenv("COLLECTION_ALERTAS", "alertas")]
parcelas = db[os.getenv("COLLECTION_PARCELAS", "datos_parcelas")]
sensores = db[os.getenv("COLLECTION_SENSORES", "datos_sensores")]

# Blueprint para visualización de gráficos
visualizacion_g_blueprint = Blueprint('visualizacion', __name__)

@visualizacion_g_blueprint.route("/datos_sensores")
def obtener_datos_sensores():
    parcela = request.args.get("parcela")
    tipo = request.args.get("tipo")

    if not parcela or not tipo:
        return jsonify({'error': 'Parámetros "parcela" y "tipo" requeridos'}), 400

    query = {
        "parcela": {"$regex": f"^{re.escape(parcela)}$", "$options": "i"},
        "tipo": {"$regex": f"^{tipo}$", "$options": "i"}
    }
    print("🔍 Filtro de búsqueda:", query)

    cursor = sensores.find(query, {
        "_id": 0,
        "timestamp": 1,
        "temperatura": 1,
        "humedad_suelo": 1,
        "ph_suelo": 1,
        "nutrientes": 1
    })

    campo_valor = ""
    is_nutriente = False
    tipo_lower = tipo.lower()
    if tipo_lower == "temperatura ambiente":
        campo_valor = "temperatura"
    elif tipo_lower == "humedad del suelo":
        campo_valor = "humedad_suelo"
    elif tipo_lower == "nivel de ph":
        campo_valor = "ph_suelo"
    elif tipo_lower == "nivel de nitrógeno":
        campo_valor = "n"
        is_nutriente = True
    elif tipo_lower == "nivel de fósforo":
        campo_valor = "p"
        is_nutriente = True
    elif tipo_lower == "nivel de potasio":
        campo_valor = "k"
        is_nutriente = True

    datos = []
    for doc in cursor:
        valor = None
        if is_nutriente and "nutrientes" in doc:
            valor = doc["nutrientes"].get(campo_valor)
        elif campo_valor in doc:
            valor = doc[campo_valor]

        if valor is not None:
            datos.append({
                "timestamp": doc["timestamp"],
                "valor": valor
            })

    return jsonify(datos)

@visualizacion_g_blueprint.route("/parcelas")
def obtener_parcelas():
    nombres = sensores.distinct("parcela")
    return jsonify([{"nombre": n} for n in nombres])
