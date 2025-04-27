from flask import Flask, jsonify
from pymongo import MongoClient
from flask_cors import CORS
import os
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

app = Flask(__name__)
CORS(app)

# Configurar MongoDB
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME")
COLLECTION_SENSORES = os.getenv("COLLECTION_NAME", "Datos_sensores")

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
sensores = db[COLLECTION_SENSORES]

@app.route("/api/sensores")
def obtener_datos_por_parcela():
    """
    Obtiene los últimos 20 datos de sensores agrupados por parcela.
    """
    # Obtener lista de parcelas distintas
    parcelas = sensores.distinct("parcela")

    respuesta = {}

    for parcela in parcelas:
        datos = list(
            sensores.find({"parcela": parcela})
            .sort("timestamp", -1)
            .limit(20)
        )

        parcela_data = {
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

        for doc in reversed(datos):  # De más viejo a más reciente
            parcela_data["timestamps"].append(doc["timestamp"].strftime("%H:%M:%S"))
            parcela_data["temperatura"].append(doc.get("temperatura"))
            parcela_data["humedad_suelo"].append(doc.get("humedad_suelo"))
            parcela_data["ph_suelo"].append(doc.get("ph_suelo"))
            nutrientes = doc.get("nutrientes", {})
            parcela_data["nutrientes"]["nitrógeno"].append(nutrientes.get("nitrógeno"))
            parcela_data["nutrientes"]["fósforo"].append(nutrientes.get("fósforo"))
            parcela_data["nutrientes"]["potasio"].append(nutrientes.get("potasio"))

        respuesta[parcela] = parcela_data

    return jsonify(respuesta)

if __name__ == "__main__":
    app.run(debug=True, port=5000)
