from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
import os
from dotenv import load_dotenv
from pymongo import MongoClient

# Cargar variables desde .env
load_dotenv()

# Configuración API
OWM_API_KEY = os.getenv("OWM_API_KEY")

# Configuración MongoDB
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME")
COLLECTION_PARCELAS = os.getenv("COLLECTION_PARCELAS", "parcelas")

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
parcelas_collection = db[COLLECTION_PARCELAS]

# Inicializar app Flask
app = Flask(__name__)
CORS(app)

# Ruta para obtener parcelas
@app.route("/parcelas")
def obtener_parcelas():
    parcelas = list(parcelas_collection.find({}, {"_id": 0, "nombre": 1, "lat": 1, "lon": 1}))
    return jsonify(parcelas)

# Ruta para obtener datos meteorológicos desde OpenWeatherMap por coordenadas
@app.route("/clima")
def clima():
    lat = request.args.get("lat")
    lon = request.args.get("lon")

    if not lat or not lon:
        return jsonify({"error": "Latitud y longitud requeridas"}), 400

    try:
        forecast_url = f"https://api.openweathermap.org/data/2.5/forecast?lat={lat}&lon={lon}&appid={OWM_API_KEY}"
        forecast_res = requests.get(forecast_url).json()
        return jsonify(forecast_res)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)
