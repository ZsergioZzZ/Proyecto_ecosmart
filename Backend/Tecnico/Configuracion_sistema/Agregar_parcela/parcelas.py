from flask import Blueprint, request, jsonify
from pymongo import MongoClient
from dotenv import load_dotenv
import os

# Cargar configuración

agregar_parcelas_blueprint = Blueprint('agregar_parcelas', __name__)

# Cargar variables de entorno

load_dotenv()

# Conexión MongoDB
client = MongoClient(os.getenv("MONGO_URI"))
db = client[os.getenv("DB_NAME")]
parcelas = db[os.getenv("COLLECTION_PARCELAS", "datos_parcelas")]

@agregar_parcelas_blueprint.route("/api/parcelas", methods=["POST"])
def guardar_parcela():
    data = request.json

    # Validar campos obligatorios
    campos = ["nombre", "numero", "ubicacion", "cultivo", "puntos", "usuario"]

    if not all(c in data for c in campos):
        return jsonify({"error": "Faltan campos obligatorios"}), 400

    # Validar que campos no estén vacíos
    if not data["nombre"].strip() or not str(data["numero"]).strip() or not data["ubicacion"].strip() or not data["cultivo"].strip():
        return jsonify({"error": "Todos los campos (nombre, parcela, ubicación, cultivo) son obligatorios"}), 400

    # Validar que puntos sea una lista válida
    if not isinstance(data["puntos"], list) or len(data["puntos"]) < 3:
        return jsonify({"error": "Debe ingresar al menos 3 puntos para formar una parcela"}), 400

    # Convertir numero a entero
    try:
        data["numero"] = int(data["numero"])
    except (ValueError, TypeError):
        return jsonify({"error": "El número debe ser un entero válido"}), 400

    # Validar que no exista ya la parcela
    existe = parcelas.find_one({
        "nombre": data["nombre"],
        "numero": data["numero"]
    })

    usuario = data["usuario"].strip()
    if not usuario or "@" not in usuario:
        return jsonify({"error": "Debe seleccionar un usuario válido"}), 400



    # Formatear puntos
    puntos_transformados = [{"lat": p[0], "lng": p[1]} for p in data["puntos"]]

    # Insertar en MongoDB
    parcelas.insert_one({
        "nombre": data["nombre"],
        "numero": data["numero"],
        "ubicacion": data["ubicacion"],
        "cultivo": data["cultivo"],
        "puntos": puntos_transformados,
        "usuario": [usuario] 
    })


    return jsonify({"mensaje": "Parcela guardada exitosamente"}), 201

@agregar_parcelas_blueprint.route("/api/parcelas-list", methods=["GET"])
def listar_parcelas():
    lista = []
    for p in parcelas.find({}, {"_id": 0, "nombre": 1, "numero": 1}):
        try:
            p["numero"] = int(p["numero"])
        except (ValueError, TypeError):
            p["numero"] = None  
        lista.append(p)
    return jsonify(lista)

@agregar_parcelas_blueprint.route("/api/parcelas-configuracion/usuarios", methods=["GET"])
def obtener_usuarios_para_parcelas():
    usuarios = db["datos_usuarios"].find({"rol": "tecnico"}, {"_id": 0, "nombre": 1, "apellidos": 1, "rol": 1, "email": 1})
    lista = []
    for u in usuarios:
        if all(k in u for k in ["nombre", "apellidos", "rol", "email"]):
            etiqueta = f"{u['rol'].capitalize()} - {u['nombre']} {u['apellidos']}"
            lista.append({"label": etiqueta, "value": u["email"]})
    return jsonify(lista)


#-------------------------------------
# Agregar Usuarios a una Parcela
#-------------------------------------

@agregar_parcelas_blueprint.route("/api/parcelas-configuracion/usuarios-todos", methods=["GET"])
def obtener_todos_usuarios():
    usuarios = db["datos_usuarios"].find({}, {"_id": 0, "nombre": 1, "apellidos": 1, "rol": 1, "email": 1}).sort([("rol", 1), ("nombre", 1), ("apellidos", 1)])
    lista = []
    for u in usuarios:
        if all(k in u for k in ["nombre", "apellidos", "rol", "email"]):
            etiqueta = f"{u['rol'].capitalize()} - {u['nombre']} {u['apellidos']}"
            lista.append({"label": etiqueta, "value": u["email"]})
    return jsonify(lista)

@agregar_parcelas_blueprint.route("/api/parcelas-lista-completa", methods=["GET"])
def lista_parcelas_completa():
    correo = request.args.get("correo")
    if not correo:
        return jsonify({"error": "Falta el correo"}), 400
    lista = []
    # Busca solo parcelas donde el correo esté en el array usuario
    for p in parcelas.find({"usuario": correo}, {"_id": 0}):
        lista.append(p)
    return jsonify(lista)


@agregar_parcelas_blueprint.route("/api/parcela/agregar-usuario", methods=["POST"])
def agregar_usuario_parcela():
    data = request.json
    nombre = data.get('nombre')
    numero = int(data.get('numero'))
    usuario = data.get('usuario')

    if not nombre or not numero or not usuario:
        return jsonify({"error": "Faltan datos"}), 400

    # 1. Actualiza el array de usuarios en la parcela
    res = parcelas.update_one(
        {"nombre": nombre, "numero": numero},
        {"$addToSet": {"usuario": usuario}}
    )
    if res.matched_count == 0:
        return jsonify({"error": "Parcela no encontrada"}), 404

    # 2. Lee el nuevo array de usuarios actualizado
    doc_parcela = parcelas.find_one({"nombre": nombre, "numero": numero})
    usuarios_actuales = doc_parcela.get("usuario", [])
    if isinstance(usuarios_actuales, str):
        usuarios_actuales = [usuarios_actuales]

    # 3. Busca el identificador de la parcela (para el campo "parcela" en alertas)
    nombre_completo = f"{nombre} - Parcela {numero}"

    # 4. Actualiza la colección de alertas con el nuevo array de usuarios
    db["alertas"].update_many(
        {"parcela": nombre_completo},
        {
            "$set": {
                "correo": usuarios_actuales,
                "correo_app": usuarios_actuales
            }
        }
    )

    # 5. Elimina todas las alertas activas de esa parcela
    db["alertas_activas"].delete_many({"parcela": nombre_completo})

    return jsonify({"mensaje": "Usuario agregado, alertas sincronizadas y alertas activas reiniciadas"}), 200
