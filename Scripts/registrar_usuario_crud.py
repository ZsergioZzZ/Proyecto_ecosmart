from flask import Flask, request, jsonify
from pymongo import MongoClient
from flask_cors import CORS
import os
from dotenv import load_dotenv

# Cargar variables de entorno desde .env
load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME")

app = Flask(__name__)
CORS(app)

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
coleccion_usuarios = db["usuarios"]

# CREATE - Registrar usuario
@app.route("/usuarios", methods=["POST"])
def registrar_usuario():
    datos = request.json
    if coleccion_usuarios.find_one({"email": datos["email"]}):
        return jsonify({"error": "Ya existe un usuario con ese correo"}), 409

    coleccion_usuarios.insert_one(datos)
    return jsonify({"mensaje": "Usuario registrado exitosamente"}), 201

# READ - Obtener todos los usuarios
@app.route('/usuarios', methods=['GET'])
def obtener_usuarios():
    usuarios = list(coleccion_usuarios.find({}, {'_id': 0, 'password': 0}))
    return jsonify(usuarios), 200

# READ - Obtener un usuario por email
@app.route('/usuarios/<email>', methods=['GET'])
def obtener_usuario(email):
    usuario = coleccion_usuarios.find_one({'email': email}, {'_id': 0, 'password': 0})
    if usuario:
        return jsonify(usuario), 200
    return jsonify({'mensaje': 'Usuario no encontrado'}), 404

# UPDATE - Actualizar usuario por email
@app.route('/usuarios/<email>', methods=['PUT'])
def actualizar_usuario(email):
    datos = request.json
    resultado = coleccion_usuarios.update_one({'email': email}, {'$set': datos})
    if resultado.modified_count > 0:
        return jsonify({'mensaje': 'Usuario actualizado'}), 200
    return jsonify({'mensaje': 'No se encontró el usuario'}), 404

# DELETE - Eliminar usuario por email
@app.route('/usuarios/<email>', methods=['DELETE'])
def eliminar_usuario(email):
    resultado = coleccion_usuarios.delete_one({'email': email})
    if resultado.deleted_count > 0:
        return jsonify({'mensaje': 'Usuario eliminado'}), 200
    return jsonify({'mensaje': 'No se encontró el usuario'}), 404

if __name__ == '__main__':
    app.run(debug=True)
