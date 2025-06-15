from flask import Blueprint, request, jsonify
from pymongo import MongoClient
from dotenv import load_dotenv
import os
from datetime import datetime
from zoneinfo import ZoneInfo



analisis_datos_blueprint = Blueprint('analisis_datos', __name__)

load_dotenv()

# Conexión a MongoDB
client = MongoClient(os.getenv("MONGO_URI"))
db = client[os.getenv("DB_NAME")]
parcelas = db[os.getenv("COLLECTION_PARCELAS", "datos_parcelas")]



def insertar_nuevo_registro(parcela, tipo, otros_campos):
    # Obtiene "ahora" en zona horaria "America/Santiago"
    timestamp_chileno = datetime.now(ZoneInfo("America/Santiago"))

    db_sensores = db["datos_sensores"]

    documento = {
        "parcela": parcela,
        "tipo": tipo,
        # … tus otros campos (p. ej. 'ubicacion', 'nutrientes', etc.)
        "timestamp": timestamp_chileno,
    }

    db_sensores = db["datos_sensores"]
    db_sensores.insert_one(documento)

@analisis_datos_blueprint.route("/api/parcela-analisis", methods=["GET"])
def obtener_parcela():
    nombre = request.args.get("nombre")
    numero = request.args.get("numero", type=int)

    if not nombre or numero is None:
        return jsonify({"error": "Faltan parámetros"}), 400

    parcela = parcelas.find_one(
        {"nombre": nombre, "numero": numero},
        {
            "_id":        0,
            "nombre":     1,
            "numero":     1,
            "ubicacion":  1,
            "cultivo":    1,
            "puntos":     1
        }
    )

    if not parcela:
        return jsonify({"error": "Parcela no encontrada"}), 404

    return jsonify(parcela), 200


@analisis_datos_blueprint.route("/api/datos_sensores", methods=["GET"])
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


@analisis_datos_blueprint.route("/parcelas", methods=["GET"])
def listar_parcelas():
    resultados = parcelas.find({}, {"nombre": 1, "numero": 1, "_id": 0})
    lista = [{"nombre": p["nombre"], "numero": p["numero"]} for p in resultados]
    return jsonify(lista)


@analisis_datos_blueprint.route("/api/parcelas-usuario", methods=["GET"])
def listar_parcelas_usuario():
    correo = request.args.get("correo")
    if not correo:
        return jsonify([]) 
    resultados = parcelas.find({"usuario": correo}, {"nombre": 1, "numero": 1, "_id": 0})
    lista = [{"nombre": p["nombre"], "numero": p["numero"]} for p in resultados]
    return jsonify(lista)



@analisis_datos_blueprint.route("/api/exactitud_sensor", methods=["GET"])
def calcular_exactitud_sensor():
    nombre = request.args.get("nombre")
    numero = request.args.get("numero", type=int)
    tipo = request.args.get("tipo")
    valor_ideal = request.args.get("valor_ideal", type=float)

    if not nombre or numero is None or not tipo or valor_ideal is None:
        return jsonify({"error": "Faltan parámetros"}), 400

    db_sensores = db["datos_sensores"]
    parcela_id = f"{nombre} - Parcela {numero}"

    registros = list(db_sensores.find({"parcela": parcela_id, "tipo": tipo}))

    if not registros:
        return jsonify({"error": "No hay datos para este sensor"}), 404

    # Determinar el campo del valor según tipo
    campo_valor = ""
    if tipo == "Temperatura Ambiente":
        campo_valor = "temperatura"
    elif tipo == "Humedad del suelo":
        campo_valor = "humedad_suelo"
    elif tipo == "Nivel de PH":
        campo_valor = "ph_suelo"
    elif tipo == "Nivel de Nutrientes":
        # Usaremos el promedio de N, P, K
        campo_valor = "nutrientes"
    else:
        return jsonify({"error": "Tipo de sensor no reconocido"}), 400

    total = 0
    dentro_rango = 0
    tolerancia = valor_ideal * 0.02

    for r in registros:
        total += 1

        if campo_valor == "nutrientes":
            n = r.get("nutrientes", {}).get("nitrógeno", 0)
            p = r.get("nutrientes", {}).get("fósforo", 0)
            k = r.get("nutrientes", {}).get("potasio", 0)
            promedio = (n + p + k) / 3
            valor = promedio
        else:
            valor = r.get(campo_valor)

        if valor is not None and (valor_ideal - tolerancia) <= valor <= (valor_ideal + tolerancia):
            dentro_rango += 1

    exactitud = round((dentro_rango / total) * 100, 2)

    return jsonify({
        "parcela": parcela_id,
        "tipo": tipo,
        "valor_ideal": valor_ideal,
        "total": total,
        "dentro_rango": dentro_rango,
        "exactitud": exactitud
    })

@analisis_datos_blueprint.route("/api/cultivos", methods=["GET"])
def obtener_valores_ideales_por_cultivo():
    try:
        cultivos = db["cultivos"]
        resultado = list(cultivos.find({}, {"_id": 0}))
        return jsonify(resultado)
    except Exception as e:
        print("ERROR:", str(e))
        return jsonify({"error": str(e)}), 500




