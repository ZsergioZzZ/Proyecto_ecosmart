import os
from flask import Blueprint, request, jsonify
from pymongo import MongoClient
from dotenv import load_dotenv

# ----------------------------
# Cargar variables de entorno
# ----------------------------
load_dotenv()

analisis_riego_blueprint =Blueprint("analisis_riego", __name__)

MONGO_URI = os.getenv("MONGO_URI", "").strip()
client = MongoClient(MONGO_URI)
db = client["EcoSmart"]
parcelas_col = db["datos_parcelas"]
sensores_col = db["datos_sensores"]


@analisis_riego_blueprint.route("/parcelas-del-usuario", methods=["GET"])
def parcelas_usuario():
    correo = request.args.get("correo")
    if not correo:
        return jsonify({"error": "Falta el parámetro correo"}), 400

    parcelas = db["datos_parcelas"].find({"usuario": correo})

    resultado = []
    for p in parcelas:
        # Tomar el primer punto si existe
        punto = p.get("puntos", [{}])[0]
        lat = punto.get("lat")
        lon = punto.get("lng")

        resultado.append({
            "id": str(p["_id"]),
            "nombre": p.get("nombre", "Sin nombre"),
            "numero": p.get("numero", "N/A"),
            "cultivo": p.get("cultivo", "No definido"),
            "lat": lat,
            "lon": lon
        })

    return jsonify(resultado)

