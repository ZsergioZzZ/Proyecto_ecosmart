from flask import Blueprint, request, jsonify
from pymongo import MongoClient
from dotenv import load_dotenv
import os

modificar_eliminar_blueprint = Blueprint('modificar_eliminar', __name__)

# Cargar configuración desde .env
load_dotenv()


# Conexión a MongoDB
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME")
COLLECTION_PARCELAS = os.getenv("COLLECTION_PARCELAS", "datos_parcelas")
COLLECTION_SENSORES = os.getenv("COLLECTION_SENSORES", "sensores")

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
parcelas = db[COLLECTION_PARCELAS]
sensores = db[COLLECTION_SENSORES]

# ------------------------
# 📍 PARCELAS
# ------------------------

@modificar_eliminar_blueprint.route("/api/parcela", methods=["GET"])
def obtener_parcela_por_nombre_y_numero():
    nombre = request.args.get("nombre")
    numero = request.args.get("numero")

    if not nombre or not numero:
        return jsonify({"error": "Faltan parámetros"}), 400

    try:
        numero = int(numero)
    except ValueError:
        return jsonify({"error": "Número inválido"}), 400

    parcela = parcelas.find_one(
        {"nombre": nombre, "numero": numero},
        {"_id": 0, "puntos": 1, "ubicacion": 1, "cultivo": 1}
    )

    if not parcela:
        return jsonify({"error": "Parcela no encontrada"}), 404

    return jsonify(parcela), 200



@modificar_eliminar_blueprint.route("/api/parcelas", methods=["GET"])
def obtener_parcelas():
    lista = []
    for p in parcelas.find({}, {"_id": 0, "nombre": 1, "numero": 1}):
        try:
            p["numero"] = int(p["numero"])
        except (ValueError, TypeError):
            p["numero"] = None
        lista.append(p)
    return jsonify(lista)

@modificar_eliminar_blueprint.route("/parcelas-modificar", methods=["PUT"])
def modificar_parcela():
    datos = request.json
    resultado = parcelas.update_one(
        {
            "nombre": datos["nombre_original"],
            "numero": int(datos.get("numero", 1))  # asegúrate de usar número también si es parte de la clave
        },
        {"$set": {
            "nombre": datos["nuevo_nombre"],
            "ubicacion": datos["ubicacion"],
            "cultivo": datos["cultivo"],
            "puntos": datos["puntos"]
        }}
    )

    if resultado.modified_count == 0:
        return jsonify({"error": "No se modificó ninguna parcela"}), 404
    return jsonify({"mensaje": "Parcela modificada"})

@modificar_eliminar_blueprint.route("/parcelas", methods=["DELETE"])
def eliminar_parcela():
    nombre = request.args.get("nombre")
    numero = request.args.get("numero", type=int)

    if not nombre or numero is None:
        return jsonify({"error": "Faltan datos para eliminar"}), 400

    resultado_parcela = parcelas.delete_one({"nombre": nombre, "numero": numero})
    if resultado_parcela.deleted_count == 0:
        return jsonify({"error": "Parcela no encontrada"}), 404

    identificador_parcela = f"{nombre} - Parcela {numero}"

    resultado_sensores = sensores.delete_many({"parcela": identificador_parcela})

    return jsonify({
        "mensaje": "Parcela eliminada",
        "sensores_eliminados": resultado_sensores.deleted_count
    }), 200

# ------------------------
# 🔧 SENSORES
# ------------------------

@modificar_eliminar_blueprint.route("/sensores", methods=["GET"])
def obtener_sensor():
    parcela = request.args.get("parcela")
    tipo = request.args.get("tipo")

    if not parcela or not tipo:
        return jsonify({"error": "Faltan parámetros"}), 400

    sensor = sensores.find_one({"parcela": parcela, "tipo": tipo}, {"_id": 0})
    if not sensor:
        return jsonify({"error": "Sensor no encontrado"}), 404

    return jsonify(sensor), 200


@modificar_eliminar_blueprint.route("/sensores", methods=["PUT"])
def modificar_sensor():
    datos = request.json
    resultado = sensores.update_one(
        {
            "parcela": datos["parcela"],
            "tipo": datos["tipo"]
        },
        {"$set": {"ubicacion": datos["ubicacion"]}}
    )
    if resultado.modified_count == 0:
        return jsonify({"error": "No se modificó el sensor"}), 404
    return jsonify({"mensaje": "Sensor modificado"})

@modificar_eliminar_blueprint.route("/sensores", methods=["DELETE"])
def eliminar_sensor():
    parcela = request.args.get("parcela")
    tipo = request.args.get("tipo")
    resultado = sensores.delete_one({"parcela": parcela, "tipo": tipo})
    if resultado.deleted_count == 0:
        return jsonify({"error": "Sensor no encontrado"}), 404
    return jsonify({"mensaje": "Sensor eliminado"})
