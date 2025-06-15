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
        {"_id": 0, "puntos": 1, "ubicacion": 1, "cultivo": 1, "usuario": 1}
    )

    if not parcela:
        return jsonify({"error": "Parcela no encontrada"}), 404

    return jsonify(parcela), 200

@modificar_eliminar_blueprint.route("/sensores-parcela", methods=["GET"])
def sensores_de_parcela():
    parcela = request.args.get("parcela")
    if not parcela:
        return jsonify({"error": "Falta el nombre de la parcela"}), 400

    sensores_encontrados = list(sensores.find(
        {"parcela": parcela},
        {"_id": 0, "tipo": 1}
    ))
    return jsonify(sensores_encontrados), 200


@modificar_eliminar_blueprint.route("/api/parcelas", methods=["GET"])
def obtener_parcelas():
    correo = request.args.get("correo")
    if not correo:
        return jsonify([]), 200  # O error, según tu preferencia

    lista = []
    for p in parcelas.find({"usuario": correo}, {"_id": 0, "nombre": 1, "numero": 1}):
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
            "numero": int(datos.get("numero", 1))
        },
        {"$set": {
            "nombre": datos["nuevo_nombre"],
            "ubicacion": datos["ubicacion"],
            "cultivo": datos["cultivo"],
            "puntos": datos["puntos"],
            "usuario": datos["usuario"]
        }}
    )

    if resultado.modified_count == 0:
        return jsonify({"error": "No se modificó ninguna parcela"}), 404

    # Solo actualizar si el campo usuario no es nulo
    if datos["usuario"]:
        nombre_completo = f"{datos['nuevo_nombre']} - Parcela {datos['numero']}"
        alertas = db["alertas"]
        alertas_activas = db["alertas_activas"]

        # Actualizar en alertas
        alertas.update_many(
            {"parcela": nombre_completo},
            {"$set": {
                "correo": datos["usuario"],
                "correo_app": datos["usuario"]
            }}
        )

        # Actualizar en alertas_activas
        alertas_activas.update_many(
            {"parcela": nombre_completo},
            {"$set": {
                "correo": datos["usuario"],
                "correo_app": datos["usuario"]
            }}
        )

    return jsonify({"mensaje": "Parcela modificada"}), 200




@modificar_eliminar_blueprint.route("/parcelas", methods=["DELETE"])
def eliminar_parcela():
    nombre = request.args.get("nombre")
    numero = request.args.get("numero", type=int)

    if not nombre or numero is None:
        return jsonify({"error": "Faltan datos para eliminar"}), 400

    # 1. Elimina la parcela en sí
    resultado_parcela = parcelas.delete_one({"nombre": nombre, "numero": numero})
    if resultado_parcela.deleted_count == 0:
        return jsonify({"error": "Parcela no encontrada"}), 404

    # 2. Nombre identificador (exactamente igual que como lo usas en las otras colecciones)
    identificador_parcela = f"{nombre} - Parcela {numero}"

    # 3. Elimina sensores asociados a esa parcela
    resultado_sensores = sensores.delete_many({"parcela": identificador_parcela})

    # 4. Elimina alertas y alertas activas asociadas a esa parcela
    alertas = db["alertas"]
    alertas_activas = db["alertas_activas"]
    resultado_alertas = alertas.delete_many({"parcela": identificador_parcela})
    resultado_alertas_activas = alertas_activas.delete_many({"parcela": identificador_parcela})

    # 5. Elimina datos_sensores de esa parcela
    datos_sensores = db["datos_sensores"]
    resultado_datos_sensores = datos_sensores.delete_many({"parcela": identificador_parcela})

    return jsonify({
        "mensaje": "Parcela eliminada",
        "sensores_eliminados": resultado_sensores.deleted_count,
        "alertas_eliminadas": resultado_alertas.deleted_count,
        "alertas_activas_eliminadas": resultado_alertas_activas.deleted_count,
        "datos_sensores_eliminados": resultado_datos_sensores.deleted_count
    }), 200


@modificar_eliminar_blueprint.route("/api/parcela/remover-usuario", methods=["POST"])
def remover_usuario_parcela():
    data = request.json
    nombre = data.get("nombre")
    numero = data.get("numero")
    usuario = data.get("usuario")

    if not nombre or not numero or not usuario:
        return jsonify({"error": "Faltan datos"}), 400

    # 1. Elimina el usuario del array en la parcela
    result = parcelas.update_one(
        {"nombre": nombre, "numero": int(numero)},
        {"$pull": {"usuario": usuario}}
    )
    if result.modified_count == 0:
        return jsonify({"error": "No se encontró la parcela o el usuario no estaba asociado"}), 404

    # 2. Elimina el usuario del array de correos en alertas y alertas_activas
    nombre_completo = f"{nombre} - Parcela {numero}"
    alertas = db["alertas"]
    alertas_activas = db["alertas_activas"]
    for coleccion in [alertas, alertas_activas]:
        coleccion.update_many(
            {"parcela": nombre_completo},
            {
                "$pull": {
                    "correo": usuario,
                    "correo_app": usuario
                }
            }
        )

    return jsonify({"mensaje": "Usuario removido correctamente"}), 200


@modificar_eliminar_blueprint.route("/api/usuario-info", methods=["GET"])
def usuario_info():
    email = request.args.get("email")
    if not email:
        return jsonify({"error": "Email requerido"}), 400
    u = db["datos_usuarios"].find_one({"email": email}, {"_id": 0, "nombre": 1, "apellidos": 1, "rol": 1, "email": 1})
    if not u:
        return jsonify({"email": email, "nombre": "", "rol": ""})
    nombre = u.get("nombre", "") + ((" " + u.get("apellidos", "")) if u.get("apellidos") else "")
    return jsonify({"email": email, "nombre": nombre.strip(), "rol": u.get("rol", "")})


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
    nombre = request.args.get("parcela")
    numero = request.args.get("numero", type=int)
    tipo = request.args.get("tipo")

    if not nombre or numero is None or not tipo:
        return jsonify({"error": "Faltan parámetros"}), 400

    # Formato identificador de parcela que usas en alertas/datos: "Nombre - Parcela numero"
    nombre_completo = f"{nombre} - Parcela {numero}"

    alertas = db["alertas"]
    alertas_activas = db["alertas_activas"]
    datos_sensores = db["datos_sensores"]

    # Eliminar el sensor de la colección 'sensores'
    resultado = sensores.delete_one({
        "parcela": nombre_completo,
        "tipo": tipo
    })
    if resultado.deleted_count == 0:
        return jsonify({"error": "Sensor no encontrado"}), 404

    # Eliminar alertas asociadas
    eliminadas_alertas = alertas.delete_many({
        "parcela": nombre_completo,
        "sensor": tipo.strip().lower()
    })

    # Eliminar alertas activas asociadas
    eliminadas_activas = alertas_activas.delete_many({
        "parcela": nombre_completo,
        "sensor": tipo.strip().lower()
    })

    # Eliminar datos de sensores (usa el identificador correcto)
    eliminados_datos = datos_sensores.delete_many({
        "parcela": nombre_completo,
        "tipo": {"$regex": f"^{tipo}$", "$options": "i"}
    })

    return jsonify({
        "mensaje": "Sensor eliminado",
        "alertas_eliminadas": eliminadas_alertas.deleted_count,
        "alertas_activas_eliminadas": eliminadas_activas.deleted_count,
        "datos_sensor_eliminados": eliminados_datos.deleted_count
    }), 200

