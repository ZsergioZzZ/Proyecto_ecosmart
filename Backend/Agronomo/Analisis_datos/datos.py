from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv()
app = Flask(__name__)
CORS(app)

# Conexión a MongoDB
client = MongoClient(os.getenv("MONGO_URI"))
db = client[os.getenv("DB_NAME")]
parcelas = db[os.getenv("COLLECTION_PARCELAS", "datos_parcelas")]

@app.route("/api/parcela", methods=["GET"])
def obtener_parcela():
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
        {"_id": 0, "nombre": 1, "numero": 1, "ubicacion": 1, "cultivo": 1, "puntos": 1}
    )

    if not parcela:
        return jsonify({"error": "Parcela no encontrada"}), 404

    return jsonify(parcela), 200


@app.route("/api/datos_sensores", methods=["GET"])
def obtener_datos_sensores():
    try:
        nombre = request.args.get("nombre")
        numero = request.args.get("numero")

        try:
            numero = int(numero)
        except ValueError:
            return jsonify({"error": "Número inválido"}), 400


        if not nombre or not numero:
            return jsonify({"error": "Faltan parámetros"}), 400
        

        db_sensores = db["datos_sensores"]

        tipos = ["Temperatura Ambiente", "Humedad del suelo", "Nivel de PH", "Nivel de Nutrientes"]
        datos = {}

        for tipo in tipos:
            registros = list(db_sensores.find(
                {"parcela": f"{nombre} - Parcela {numero}", "tipo": tipo},
                sort=[("timestamp", -1)],
                limit=10
            ))

            for doc in registros:
                doc.pop("_id", None)

            datos[tipo] = registros

        return jsonify(datos)

    except Exception as e:
        print("ERROR:", str(e))
        return jsonify({"error": str(e)}), 500




@app.route("/parcelas", methods=["GET"])
def listar_parcelas():
    resultados = parcelas.find({}, {"nombre": 1, "numero": 1, "_id": 0})
    lista = [{"nombre": p["nombre"], "numero": p["numero"]} for p in resultados]
    return jsonify(lista)


if __name__ == "__main__":
    app.run(debug=True)
