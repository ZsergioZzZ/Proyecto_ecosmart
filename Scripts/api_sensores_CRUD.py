
from flask import Flask, request, jsonify
from pymongo import MongoClient
from bson import ObjectId
from flask_cors import CORS
import os
from dotenv import load_dotenv

# Cargar variables de entorno desde .env
load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME")

app = Flask(__name__)
CORS(app)

# Conexión a MongoDB
client = MongoClient(MONGO_URI)
db = client[DB_NAME]
datos_sensores = db["Datos_sensores"]
sensores = db["Sensores"]

# --- CRUD para Datos_sensores ---

@app.route('/datos_sensores', methods=['POST'])  # Crear un nuevo dato de sensor
def guardar_dato_sensor():
    datos = request.json
    resultado = datos_sensores.insert_one(datos)
    return jsonify({'mensaje': 'Dato insertado', 'id': str(resultado.inserted_id)}), 201

@app.route('/datos_sensores/parcela/<nombre>', methods=['GET'])  # Obtener datos de sensores por parcela
def sensores_por_parcela(nombre):
    datos = list(datos_sensores.find({'parcela': nombre}).sort('_id', -1).limit(10))
    for doc in datos:
        doc['_id'] = str(doc['_id'])
    return jsonify(datos), 200

# --- CRUD para sensores (definición) ---

@app.route("/sensores", methods=["POST"])
def crear_sensor():
    datos = request.json
    if sensores.find_one({"id": datos["id"], "parcela": datos["parcela"]}):
        return jsonify({"error": "Ya existe un sensor con ese ID en esa parcela"}), 409
    sensores.insert_one(datos)
    return jsonify({"mensaje": "Sensor creado con éxito"}), 201

@app.route("/sensores", methods=["GET"])
def obtener_todos_los_sensores():
    resultado = list(sensores.find())
    for doc in resultado:
        doc["_id"] = str(doc["_id"])
    return jsonify(resultado)

@app.route('/sensores/<int:id>', methods=['PUT'])  # Actualizar sensor por ID 
def actualizar_sensor_definido(id):
    datos = request.json
    resultado = sensores.update_one({"id": id}, {"$set": datos})
    if resultado.modified_count > 0:
        return jsonify({"mensaje": "Sensor actualizado"}), 200
    return jsonify({"mensaje": "No se encontró el sensor"}), 404

@app.route('/sensores/<int:id>', methods=['DELETE'])  # Eliminar sensor por ID 
def eliminar_sensor_definido(id):
    resultado = sensores.delete_one({"id": id})
    if resultado.deleted_count > 0:
        return jsonify({"mensaje": "Sensor eliminado"}), 200
    return jsonify({"mensaje": "No se encontró el sensor"}), 404

if __name__ == '__main__':
    app.run(debug=True)
