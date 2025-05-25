from flask import Flask, request, jsonify
from pymongo import MongoClient
from flask_cors import CORS
from dotenv import load_dotenv
import os
import re
import unicodedata

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME")

app = Flask(__name__)
CORS(app)
client = MongoClient(MONGO_URI)
db = client[DB_NAME]
coleccion_usuarios = db["datos_usuarios"]


def validar_email(email):
    return re.match(r"^[\w\.-]+@[\w\.-]+\.\w+$", email)

def validar_password(password):
    return len(password) >= 8 and re.search(r"[A-Z]", password) and re.search(r"\d", password)

def validar_telefono(telefono):
    return telefono.isdigit() and len(telefono) == 9 and telefono.startswith("9")

def validar_rol(rol):
    return rol.lower() in ["agricultor", "agronomo", "tecnico"]


@app.route("/usuarios", methods=["POST"])
def registrar_usuario():
    datos = request.json
    email = datos.get("email")
    password = datos.get("password")
    telefono = datos.get("telefono")
    rol = datos.get("rol")

    if not (email and password and telefono and rol):
        return jsonify({"error": "Faltan campos obligatorios"}), 400

    rol_limpio = limpiar_rol(rol)
    if not validar_rol(rol_limpio):
        return jsonify({"error": "Rol inválido"}), 400

    if not validar_email(email):
        return jsonify({"error": "Email inválido"}), 400

    if not validar_password(password):
        return jsonify({"error": "La contraseña debe tener al menos 8 caracteres, 1 número y 1 mayúscula"}), 400

    if not validar_telefono(telefono):
        return jsonify({"error": "El teléfono debe comenzar con 9 y tener 9 dígitos"}), 400

    if coleccion_usuarios.find_one({"email": email}):
        return jsonify({"error": "Ya existe un usuario con ese correo"}), 409

    datos["rol"] = rol_limpio
    coleccion_usuarios.insert_one(datos)
    return jsonify({"mensaje": "Usuario registrado exitosamente"}), 201


@app.route('/usuarios', methods=['GET'])
def obtener_usuarios():
    usuarios = list(coleccion_usuarios.find({}, {'_id': 0, 'password': 0}))
    return jsonify(usuarios), 200

@app.route('/usuarios/<email>', methods=['GET'])
def obtener_usuario(email):
    from urllib.parse import unquote
    email = unquote(email).strip().lower()
    usuario = coleccion_usuarios.find_one({'email': email}, {'_id': 0, 'password': 0})
    if usuario:
        return jsonify(usuario), 200
    return jsonify({'mensaje': 'Usuario no encontrado'}), 404


def limpiar_rol(rol):
    rol = rol.lower()
    return unicodedata.normalize('NFD', rol).encode('ascii', 'ignore').decode('utf-8')


@app.route('/usuarios/<email>', methods=['PUT'])
def actualizar_usuario(email):
    from urllib.parse import unquote
    email = unquote(email)
    datos = request.json

    if "telefono" in datos and not validar_telefono(datos["telefono"]):
        return jsonify({"error": "Teléfono inválido"}), 400
    if "rol" in datos:
        datos["rol"] = limpiar_rol(datos["rol"])
        if not validar_rol(datos["rol"]):
            return jsonify({"error": "Rol inválido"}), 400

    if "password" in datos and not validar_password(datos["password"]):
        return jsonify({"error": "Contraseña insegura"}), 400

    resultado = coleccion_usuarios.update_one({'email': email}, {'$set': datos})
    if resultado.modified_count > 0:
        return jsonify({'mensaje': 'Usuario actualizado'}), 200
    return jsonify({'mensaje': 'No se encontró el usuario'}), 404

@app.route('/usuarios/<email>', methods=['DELETE'])
def eliminar_usuario(email):
    from urllib.parse import unquote
    email = unquote(email)
    resultado = coleccion_usuarios.delete_one({'email': email})
    if resultado.deleted_count > 0:
        return jsonify({'mensaje': 'Usuario eliminado'}), 200
    return jsonify({'mensaje': 'No se encontró el usuario'}), 404

if __name__ == '__main__':
    app.run(debug=True, port=5050)
