from flask import Flask, jsonify
from pymongo import MongoClient
from flask_cors import CORS
import os
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

app = Flask(__name__)
CORS(app)  # Permite llamadas desde tu HTML

# Configurar MongoDB
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME")
COLLECTION_SENSORES = os.getenv("COLLECTION_NAME", "Datos_sensores")

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
sensores = db[COLLECTION_SENSORES]

@app.route("/api/sensores")
def obtener_datos():
    """
    Obtiene los últimos datos de sensores agrupados por tiempo.
    """
    datos = list(sensores.find().sort("timestamp", -1).limit(50))  # Últimos 50 datos

    # Convertir a formato JSON serializable
    respuesta = {
        "timestamps": [],
        "temperatura": [],
        "humedad_suelo": [],
        "ph_suelo": [],
        "nutrientes": {
            "nitrógeno": [],
            "fósforo": [],
            "potasio": []
        }
    }

    for doc in reversed(datos):  # Para que estén de más viejo a más reciente
        respuesta["timestamps"].append(doc["timestamp"].strftime("%H:%M:%S"))
        respuesta["temperatura"].append(doc.get("temperatura"))
        respuesta["humedad_suelo"].append(doc.get("humedad_suelo"))
        respuesta["ph_suelo"].append(doc.get("ph_suelo"))
        nutrientes = doc.get("nutrientes", {})
        respuesta["nutrientes"]["nitrógeno"].append(nutrientes.get("nitrógeno"))
        respuesta["nutrientes"]["fósforo"].append(nutrientes.get("fósforo"))
        respuesta["nutrientes"]["potasio"].append(nutrientes.get("potasio"))

    return jsonify(respuesta)

if __name__ == "__main__":
    app.run(debug=True, port=5000)
