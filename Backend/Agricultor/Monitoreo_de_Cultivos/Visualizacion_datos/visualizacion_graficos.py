from flask import Blueprint, jsonify
from pymongo import MongoClient
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv
import certifi

load_dotenv()

# Crear blueprint
visualizacion_g_blueprint = Blueprint('visualizacion_g', __name__)

from flask import Blueprint, render_template

visualizacion_web = Blueprint("visualizacion_web", __name__)

@visualizacion_web.route("/monitoreo")
def vista_monitoreo():
    return render_template("monitoreo.html")


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
    try:
        parcelas = db["datos_parcelas"].find({}, {"_id": 0, "nombre": 1, "numero": 1})
        return jsonify(list(parcelas))
    except Exception as e:
        return jsonify({"error": str(e)}), 500



from urllib.parse import unquote

@visualizacion_g_blueprint.route('/api/datos-sensores/<path:parcela>', methods=['GET'])
def obtener_datos_sensores(parcela):
    try:
        parcela = unquote(parcela)  
        fecha_inicio = datetime.now() - timedelta(days=7)

        datos = list(datos_col.aggregate([
            {
                "$match": {
                    "parcela": parcela,
                    "timestamp": {"$gte": fecha_inicio}
                }
            },
            { "$sort": {"timestamp": 1} },
            { "$project": {
                "_id": 0,
                "fecha": {"$dateToString": {"format": "%Y-%m-%dT%H:%M:%S", "date": "$timestamp"}},
                "temperatura": 1,
                "humedad_suelo": 1,
                "ph_suelo": 1,
                "nutrientes.nitrogeno": 1,
                "nutrientes.fosforo": 1,
                "nutrientes.potasio": 1
            }}
        ]))

        for d in datos:
            if 'nutrientes' in d:
                d.update(d['nutrientes'])
                del d['nutrientes']

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
                    "avg_humedad": {"$avg": "$humedad_suelo"},
                    "avg_ph": {"$avg": "$ph"},
                    "avg_nitrogeno": {"$avg": "$nutrientes.nitrogeno"},
                    "avg_fosforo": {"$avg": "$nutrientes.fosforo"},
                    "avg_potasio": {"$avg": "$nutrientes.potasio"}
                }
            },
            { "$project": {
    "_id": 0,
    "fecha": {"$dateToString": {"format": "%Y-%m-%dT%H:%M:%S", "date": "$timestamp"}},
    "temperatura": 1,
    "humedad_suelo": 1,
    "ph_suelo": 1,
    "nutrientes.nitrogeno": 1,
    "nutrientes.fosforo": 1,
    "nutrientes.potasio": 1
}}

        ]

        resultado = datos_col.aggregate(pipeline)
        datos = next(resultado, {})
        
        return jsonify(datos)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
