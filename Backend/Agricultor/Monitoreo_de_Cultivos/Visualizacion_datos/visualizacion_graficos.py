from flask import Flask, jsonify
from pymongo import MongoClient
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv
from flask_cors import CORS
import certifi

# Configuración inicial
load_dotenv()
app = Flask(__name__)
CORS(app)

# Conexión a MongoDB
client = MongoClient(
    os.getenv("MONGO_URI"),
    tlsCAFile=certifi.where()
)
db = client[os.getenv("DB_NAME")]

@app.route('/api/parcelas', methods=['GET'])
def obtener_parcelas():
    try:
        parcelas = db.datos_sensores.distinct("parcela")
        return jsonify(parcelas)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/datos-sensores/<parcela>', methods=['GET'])
def obtener_datos_sensores(parcela):
    try:
        # Obtener datos de los últimos 7 días
        fecha_inicio = datetime.now() - timedelta(days=7)
        
        datos = list(db.datos_sensores.find(
            {
                "parcela": parcela,
                "fecha": {"$gte": fecha_inicio}
            },
            {
                "_id": 0,
                "temperatura": 1,
                "humedad_suelo": 1,
                "ph": 1,
                "nitrogeno": 1,
                "fosforo": 1,
                "potasio": 1,
                "fecha": 1
            }
        ).sort("fecha", 1))
        
        # Formatear fechas
        for dato in datos:
            if 'fecha' in dato:
                dato['fecha'] = dato['fecha'].isoformat()
        
        return jsonify(datos)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
