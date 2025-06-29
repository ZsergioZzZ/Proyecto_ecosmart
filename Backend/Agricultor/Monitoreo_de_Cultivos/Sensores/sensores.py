from flask import Blueprint, request, jsonify
from pymongo import MongoClient
from dotenv import load_dotenv
import os

sensores_moni_cultivos_blueprint = Blueprint('sensores_moni_cultivos', __name__)

load_dotenv()

# Conexión a MongoDB
client = MongoClient(os.getenv("MONGO_URI"))
db = client[os.getenv("DB_NAME")]
parcelas = db[os.getenv("COLLECTION_PARCELAS", "datos_parcelas")]

@sensores_moni_cultivos_blueprint.route("/api/sensores/parcela", methods=["GET"])



def obtener_parcela():
    nombre = request.args.get("nombre")
    numero = request.args.get("numero")

    try:
        numero = int(numero)
    except ValueError:
        return jsonify({"error": "Número inválido"}), 400

    if not nombre or not numero:
        return jsonify({"error": "Faltan parámetros"}), 400

    parcela = parcelas.find_one(
        {"nombre": nombre, "numero": numero},
        {"_id": 0, "nombre": 1, "numero": 1, "ubicacion": 1, "cultivo": 1, "puntos": 1}
    )

    if not parcela:
        return jsonify({"error": "Parcela no encontrada"}), 404

    return jsonify(parcela), 200


def es_valido(doc):
    # Considera inválido si no tiene campo 'valor' o si es None
    return "valor" in doc and doc["valor"] is not None


def obtener_valor(doc, tipo):
    campos = {
        "Temperatura Ambiente": "temperatura",
        "Humedad del suelo": "humedad",
        "Nivel de PH": "ph",
        "Nivel de Nutrientes": "nutrientes"
    }
    campo_valor = campos.get(tipo)
    return doc.get(campo_valor) if campo_valor in doc else None


@sensores_moni_cultivos_blueprint.route('/api/sensores/parcelas-usuario', methods=['GET'])
def obtener_parcelas_por_usuario():
    correo = request.args.get("correo")
    if not correo:
        return jsonify([])

    resultado = list(parcelas.find({"usuario": correo}, {"_id": 0, "nombre": 1, "numero": 1}))
    return jsonify(resultado)


@sensores_moni_cultivos_blueprint.route("/api/sensores/datos", methods=["GET"])
def obtener_datos_sensores():
    try:
        nombre = request.args.get("nombre")
        numero = request.args.get("numero")
        if not nombre or not numero:
            return jsonify({"error": "Faltan parámetros"}), 400

        db_sensores = db["datos_sensores"]

        # Ahora definimos cada nutriente como un tipo separado
        tipos = {
            "Temperatura Ambiente": lambda d: d.get("temperatura"),
            "Humedad del suelo": lambda d: d.get("humedad") or d.get("humedad_suelo"),
            "Nivel de PH": lambda d: d.get("ph") or d.get("ph_suelo"),
            "Nitrógeno": lambda d: (d.get("nutrientes") or {}).get("nitrógeno"),
            "Fósforo":   lambda d: (d.get("nutrientes") or {}).get("fósforo"),
            "Potasio":   lambda d: (d.get("nutrientes") or {}).get("potasio")
        }

        datos = {}
        for tipo, extraer_valor in tipos.items():
            cursor = db_sensores.find(
                {"parcela": f"{nombre} - Parcela {numero}", "tipo": tipo if tipo in ["Temperatura Ambiente","Humedad del suelo","Nivel de PH"] else "Nivel de Nutrientes"},
                sort=[("timestamp", -1)],
                limit=5  # buscamos hasta 5 por si hay nulos
            )
            registros = list(cursor)
            # eliminamos el _id
            for doc in registros:
                doc.pop("_id", None)

            # buscamos el primer registro donde exista valor propio
            for doc in registros:
                valor = extraer_valor(doc)
                if valor is not None:
                    doc["valor"] = valor
                    datos[tipo] = [doc]
                    break
            else:
                datos[tipo] = []

        return jsonify(datos)

    except Exception as e:
        print("ERROR:", str(e))
        return jsonify({"error": str(e)}), 500


@sensores_moni_cultivos_blueprint.route("/api/sensores/parcelas", methods=["GET"])

def listar_parcelas():
    resultados = parcelas.find({}, {"nombre": 1, "numero": 1, "_id": 0})
    lista = [{"nombre": p["nombre"], "numero": p["numero"]} for p in resultados]
    return jsonify(lista)

