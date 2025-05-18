from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from dotenv import load_dotenv
import os

# Cargar configuración
load_dotenv()
app = Flask(__name__)
CORS(app)

# Conexión MongoDB
client = MongoClient(os.getenv("MONGO_URI"))
db = client[os.getenv("DB_NAME")]
parcelas = db[os.getenv("COLLECTION_PARCELAS", "datos_parcelas")]

@app.route("/api/parcelas", methods=["POST"])
def guardar_parcela():
    data = request.json

     # Validar que todos los campos estén presentes
    campos = ["nombre", "numero", "ubicacion", "cultivo", "puntos"]
    if not all(c in data for c in campos):
        return jsonify({"error": "Faltan campos obligatorios"}), 400

    # Validar que nombre, numero, ubicacion y cultivo no estén vacíos
    if not data["nombre"].strip() or not str(data["numero"]).strip() or not data["ubicacion"].strip() or not data["cultivo"].strip():
        return jsonify({"error": "Todos los campos (nombre, parcela, ubicación, cultivo) son obligatorios"}), 400

    # Validar que haya al menos 3 puntos
    if not isinstance(data["puntos"], list) or len(data["puntos"]) < 3:
        return jsonify({"error": "Debe ingresar al menos 3 puntos para formar una parcela"}), 400

    # Validar que no exista otra parcela con el mismo nombre y número
    existe = parcelas.find_one({
        "nombre": data["nombre"],
        "numero": data["numero"]
    })

    if existe:
        return jsonify({"error": "Ya existe una parcela con ese número en este mismo fundo"}), 400


    puntos_transformados = [
        {"lat": punto[0], "lng": punto[1]} for punto in data["puntos"]
    ]

    parcelas.insert_one({
        "nombre": data["nombre"],
        "numero": data["numero"],
        "ubicacion": data["ubicacion"],
        "cultivo": data["cultivo"],
        "puntos": puntos_transformados
    })

    return jsonify({"mensaje": "Parcela guardada exitosamente"}), 201

if __name__ == "__main__":
    app.run(debug=True)
