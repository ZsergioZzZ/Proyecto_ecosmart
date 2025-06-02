from flask import Blueprint, jsonify
from pymongo import MongoClient
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv
import certifi

# Configuración inicial
load_dotenv()

# Crear blueprint
visualizacion_g_blueprint = Blueprint('visualizacion_g', __name__)

# Conexión a MongoDB (compatible con tu estructura existente)
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME")
COLLECTION_DATOS = "datos_sensores"

try:
    client = MongoClient(
        MONGO_URI,
        tlsCAFile=certifi.where(),
        connectTimeoutMS=5000,
        serverSelectionTimeoutMS=5000
    )
    db = client[DB_NAME]
    datos_col = db[COLLECTION_DATOS]
    print("Conexión a MongoDB establecida correctamente")
except Exception as e:
    print(f"Error al conectar a MongoDB: {e}")
    datos_col = None

@visualizacion_g_blueprint.route('/api/parcelas', methods=['GET'])
def obtener_parcelas():
    if not datos_col:
        return jsonify({"error": "Error de conexión a la base de datos"}), 500
    
    try:
        parcelas = datos_col.distinct("parcela")
        return jsonify(parcelas)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@visualizacion_g_blueprint.route('/api/datos-sensores/<parcela>', methods=['GET'])
def obtener_datos_sensores(parcela):
    if not datos_col:
        return jsonify({"error": "Error de conexión a la base de datos"}), 500
    
    try:
        # Obtener datos de los últimos 7 días
        fecha_inicio = datetime.now() - timedelta(days=7)

        pipeline = [
            {
                "$match": {
                    "parcela": parcela,
                    "timestamp": {"$gte": fecha_inicio}
                }
            },
            {
                "$sort": {"timestamp": 1}
            },
            {
                "$project": {
                    "_id": 0,
                    "fecha": {"$dateToString": {"format": "%Y-%m-%dT%H:%M:%S", "date": "$timestamp"}},
                    "temperatura": 1,
                    "humedad": 1,
                    "ph": 1,
                    "nutrientes.nitrogeno": 1,
                    "nutrientes.fosforo": 1,
                    "nutrientes.potasio": 1
                }
            }
        ]

        datos = list(datos_col.aggregate(pipeline))
        
        # Transformar estructura de nutrientes
        for dato in datos:
            if 'nutrientes' in dato:
                dato.update(dato['nutrientes'])
                del dato['nutrientes']
        
        return jsonify(datos)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@visualizacion_g_blueprint.route('/api/datos-radar/<parcela>', methods=['GET'])
def obtener_datos_radar(parcela):
    if not datos_col:
        return jsonify({"error": "Error de conexión a la base de datos"}), 500
    
    try:
        # Obtener datos de los últimos 7 días para calcular promedios
        fecha_inicio = datetime.now() - timedelta(days=7)

        pipeline = [
            {
                "$match": {
                    "parcela": parcela,
                    "timestamp": {"$gte": fecha_inicio}
                }
            },
            {
                "$group": {
                    "_id": None,
                    "avg_temperatura": {"$avg": "$temperatura"},
                    "avg_humedad": {"$avg": "$humedad"},
                    "avg_ph": {"$avg": "$ph"},
                    "avg_nitrogeno": {"$avg": "$nutrientes.nitrogeno"},
                    "avg_fosforo": {"$avg": "$nutrientes.fosforo"},
                    "avg_potasio": {"$avg": "$nutrientes.potasio"}
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "temperatura": {"$round": ["$avg_temperatura", 2]},
                    "humedad": {"$round": ["$avg_humedad", 2]},
                    "ph": {"$round": ["$avg_ph", 2]},
                    "nitrogeno": {"$round": ["$avg_nitrogeno", 2]},
                    "fosforo": {"$round": ["$avg_fosforo", 2]},
                    "potasio": {"$round": ["$avg_potasio", 2]}
                }
            }
        ]

        resultado = datos_col.aggregate(pipeline)
        datos = next(resultado, {})
        
        return jsonify(datos)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
