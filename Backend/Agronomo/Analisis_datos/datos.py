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

    parcela_id = f"{nombre} - Parcela {numero}"
    registros = list(db["datos_sensores"].find({"parcela": parcela_id, "tipo": "Nivel de Nutrientes" if tipo in ["nitrógeno", "fósforo", "potasio"] else tipo}))

    if not registros:
        return jsonify({"error": "No hay datos para este sensor"}), 404

    # Detectar campo correcto
    if tipo == "Temperatura Ambiente":
        campo_valor = "temperatura"
    elif tipo == "Humedad del suelo":
        campo_valor = "humedad_suelo"
    elif tipo == "Nivel de PH":
        campo_valor = "ph_suelo"
    elif tipo in ["nitrógeno", "fósforo", "potasio"]:
        campo_valor = f"nutrientes.{tipo}"
    else:
        return jsonify({"error": "Tipo de sensor no reconocido"}), 400

    total = 0
    dentro_rango = 0
    tolerancia = valor_ideal * 0.02

    for r in registros:
        total += 1

        # Extraer el valor dependiendo del campo
        if campo_valor.startswith("nutrientes."):
            clave = campo_valor.split(".")[1]
            valor = r.get("nutrientes", {}).get(clave)
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
    

@analisis_datos_blueprint.route("/api/exportar_exactitud_csv", methods=["POST"])
def exportar_exactitud_csv():
    from flask import Response
    from io import StringIO
    import csv
    try:
        data = request.get_json(force=True)
        nombre = data.get("nombre")
        numero = data.get("numero")
        sensores = data.get("sensores")

        if not nombre or numero is None or not sensores:
            return jsonify({"error": "Faltan datos"}), 400

        parcela_id = f"{nombre} - Parcela {numero}"
        registros = db["datos_sensores"]
        salida = StringIO()
        writer = csv.writer(salida)
        writer.writerow(["Parcela", "Tipo Sensor", "Valor Ideal", "Exactitud (%)", "Fecha"])

        for sensor in sensores:
            tipo = sensor.get("tipo")
            valor_ideal = sensor.get("valor_ideal")
            if tipo is None or valor_ideal is None:
                continue

            docs = list(registros.find({"parcela": parcela_id, "tipo": "Nivel de Nutrientes" if tipo in ["nitrógeno", "fósforo", "potasio"] else tipo}))
            if not docs:
                continue

            campo = {
                "Temperatura Ambiente": "temperatura",
                "Humedad del suelo": "humedad_suelo",
                "Nivel de PH": "ph_suelo"
            }.get(tipo, f"nutrientes.{tipo}" if tipo in ["nitrógeno", "fósforo", "potasio"] else None)

            if not campo:
                continue

            total = 0
            dentro = 0
            tolerancia = float(valor_ideal) * 0.02

            for doc in docs:
                total += 1
                valor = None
                if campo.startswith("nutrientes."):
                    clave = campo.split(".")[1]
                    valor = doc.get("nutrientes", {}).get(clave)
                else:
                    valor = doc.get(campo)

                if valor is not None and (float(valor_ideal) - tolerancia) <= valor <= (float(valor_ideal) + tolerancia):
                    dentro += 1

            exactitud = round((dentro / total) * 100, 2) if total else 0
            writer.writerow([parcela_id, tipo, valor_ideal, exactitud, datetime.now().strftime("%Y-%m-%d %H:%M:%S")])

        return Response(salida.getvalue(), mimetype="text/csv")

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500





