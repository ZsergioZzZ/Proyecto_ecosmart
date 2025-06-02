# sensores_blueprint.py

from flask import Blueprint, request, jsonify
from pymongo import MongoClient
from datetime import datetime
import os
import requests
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_API_URL = os.getenv("OPENROUTER_API_URL")

sensores_bp = Blueprint('sensores', __name__, )

# Conexión a MongoDB
client = MongoClient(MONGO_URI)
db = client["EcoSmart"]
parcelas_col = db["datos_parcelas"]
sensores_col = db["datos_sensores"]


@sensores_bp.route("/parcelas_recomendacion-ia", methods=["GET"])
def listar_parcelas():
    """
    Devuelve [ { "_id": "<hex_id>", "displayName": "NombreParcela - Parcela <numero>" }, ... ]
    """
    resultados = []
    cursor = parcelas_col.find({}, {"nombre": 1, "numero": 1})
    for doc in cursor:
        _id = str(doc["_id"])
        nombre = doc.get("nombre", "").strip()
        numero = doc.get("numero", "")
        display_name = f"{nombre} - Parcela {numero}"
        resultados.append({"_id": _id, "displayName": display_name})
    return jsonify(resultados), 200


@sensores_bp.route("/sensores_recomendacion-ia", methods=["GET"])
def tipos_sensores_por_parcela():
    """
    Recibe ?parcela=<displayName>  (por ejemplo: "Parcelas Aires de Colchagua - Parcela 1")
    Devuelve los distintos tipos de sensores que hay en 'datos_sensores' para esa parcela:
      [ "Temperatura Ambiente", "Nivel de PH", "Humedad del suelo", ... ]
    """
    parcela = request.args.get("parcela", "").strip()
    if parcela == "":
        return jsonify({"error": "Parámetro 'parcela' es requerido"}), 400

    # Distinct obtiene los valores únicos del campo "tipo" filtrando por parcela
    tipos = sensores_col.distinct("tipo", {"parcela": parcela})
    return jsonify(tipos), 200

