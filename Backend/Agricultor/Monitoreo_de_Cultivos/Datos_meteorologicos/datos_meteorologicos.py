from flask import Blueprint, jsonify, request
import requests
import os
from dotenv import load_dotenv
from pymongo import MongoClient

datos_meteo_blueprint = Blueprint('datos_meteo_blueprint', __name__)

# Cargar variables desde .env
load_dotenv()

OWM_API_KEY = os.getenv("OWM_API_KEY")
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME")
COLLECTION_PARCELAS = os.getenv("COLLECTION_PARCELAS", "datos_parcelas")

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
parcelas_collection = db[COLLECTION_PARCELAS]

@datos_meteo_blueprint.route("/meteo/parcelas")
def obtener_parcelas():
    parcelas_db = list(parcelas_collection.find({}, {
        "_id": 0, "nombre": 1, "numero": 1, "ubicacion": 1, "puntos": 1, "punto": 1
    }))
    parcelas = []
    for p in parcelas_db:
        puntos = p.get("puntos") or p.get("punto")
        if puntos and len(puntos) > 0:
            primer_punto = puntos[0]
            if "lat" in primer_punto and "lng" in primer_punto:
                parcelas.append({
                    "nombre": p["nombre"],
                    "numero": p["numero"],
                    "ubicacion": p.get("ubicacion", ""),
                    "lat": primer_punto["lat"],
                    "lon": primer_punto["lng"]
                })
    return jsonify(parcelas)

@datos_meteo_blueprint.route("/meteo/clima")
def clima():
    lat = request.args.get("lat")
    lon = request.args.get("lon")
    if not lat or not lon:
        return jsonify({"error": "Latitud y longitud requeridas"}), 400

    try:
        url = f"https://api.openweathermap.org/data/2.5/forecast?lat={lat}&lon={lon}&appid={OWM_API_KEY}&units=metric&lang=es"
        res = requests.get(url)
        data = res.json()
        if res.status_code != 200:
            return jsonify(data), res.status_code
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
