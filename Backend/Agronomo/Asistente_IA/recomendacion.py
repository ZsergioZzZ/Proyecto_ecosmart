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
    # 1) Leer el email que viene por query-string
    user_email = request.args.get("email", "").strip()
    if not user_email:
        return jsonify({"error": "Falta parámetro email"}), 400

    # 2) Filtrar documentos donde el array 'usuario' contenga ese email
    filtro = {"usuario": user_email}

    # 3) Ejecutar la consulta proyectando solo nombre y número
    resultados = []
    cursor = parcelas_col.find(filtro, {"nombre": 1, "numero": 1})
    for doc in cursor:
        resultados.append({
            "_id": str(doc["_id"]),
            "displayName": f"{doc.get('nombre','').strip()} - Parcela {doc.get('numero','')}"
        })

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

