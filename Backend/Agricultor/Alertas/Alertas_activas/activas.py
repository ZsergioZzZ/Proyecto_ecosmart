from flask import Blueprint, jsonify, request
from pymongo import MongoClient
from dotenv import load_dotenv
import os

alertas_agricultor_blueprint = Blueprint(´alertas_agricultor´, __name__)

client = MongoClient(os.getenv("MONGO_URI"))
db = client[os.getenv("DB_NAME")]

alertas_collection = db["alertas"]
datos_collection = db["datos_sensores"]

@alertas_agricultor_blueprint.route("/parcelas", methods=["GET"])
def obtener_parcelas():
    parcelas = alertas_collection.distinct("parcela")
    return jsonify(parcelas)

@alertas_agricultor_blueprint.route("/alertas_por_parcela", methods=["GET"])
def alertas_por_parcela():
    nombre_parcela = request.args.get("nombre")
    categorias = ["temperatura ambiente", "humedad del suelo", "nivel de ph", "nivel de nutrientes"]
    resultado = {}

    for sensor in categorias:
        alerta = alertas_collection.find_one({"sensor": sensor, "parcela": nombre_parcela})
        dato = datos_collection.find_one({"sensor": sensor, "parcela": nombre_parcela}, sort=[("fecha", -1)])

        if not alerta:
            continue

        if sensor == "nivel de nutrientes" and "nutrientes" in alerta:
            resultado[sensor] = {
                "titulo": "NIVEL DE NUTRIENTES",
                "valor_actual": dato.get("valor", "No disponible") if dato else "No disponible",
                "cultivo": alerta.get("parcela", "Parcela no especificada"),
                "n": alerta["nutrientes"].get("n"),
                "p": alerta["nutrientes"].get("p"),
                "k": alerta["nutrientes"].get("k")
            }
        else:
            resultado[sensor] = {
                "titulo": sensor.upper(),
                "valor_actual": dato.get("valor", "No disponible") if dato else "No disponible",
                "menor": f"MENOR a {alerta.get('umbral_bajo')}: {alerta.get('descripcion_bajo')}",
                "mayor": f"MAYOR a {alerta.get('umbral_alto')}: {alerta.get('descripcion_alto')}",
                "cultivo": alerta.get("parcela", "Parcela no especificada")
            }

    return jsonify(resultado)
