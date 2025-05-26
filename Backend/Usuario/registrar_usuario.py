from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from dotenv import load_dotenv
import os
from validaciones import validar_email, validar_password, validar_telefono, validar_rol
import requests


# Configuración
load_dotenv()
app = Flask(__name__)
CORS(app)

client = MongoClient(os.getenv("MONGO_URI"))
db = client[os.getenv("DB_NAME")]
usuarios = db[os.getenv("COLLECTION_USUARIOS", "datos_usuarios")]


@app.route("/verificar-email-real", methods=["POST"])
def verificar_email_real():
    data = request.get_json()
    email = data.get("email", "")
    api_key = os.getenv("ABSTRACT_API_KEY")

    res = requests.get(
        "https://emailvalidation.abstractapi.com/v1/",
        params={"api_key": api_key, "email": email}
    )

    if res.status_code != 200:
        return jsonify({"error": "No se pudo verificar"}), 500

    resultado = res.json()
    return jsonify({
        "deliverability": resultado.get("deliverability", "UNKNOWN")
    })



@app.route("/crear-cuenta", methods=["POST"])
def crear_usuario():
    data = request.get_json()

    # Validaciones
    if not validar_email(data["email"]):
        return jsonify({"success": False, "message": "Email inválido."}), 400

    if usuarios.find_one({"email": data["email"]}):
        return jsonify({"success": False, "message": "El correo ya está registrado."}), 409

    if not validar_password(data["contrasena"]):
        return jsonify({"success": False, "message": "Contraseña insegura. Mínimo 8 caracteres, 1 número, 1 mayúscula."}), 400

    if not validar_telefono(data["celular"]):
        return jsonify({"success": False, "message": "Teléfono inválido. Debe comenzar con 9 y tener 9 dígitos."}), 400

    if not validar_rol(data["rol"]):
        return jsonify({"success": False, "message": "Rol inválido. Usa 'agricultor', 'agronomo' o 'tecnico'."}), 400

    usuario = {
        "nombre": data["nombre"],
        "apellidos": data["apellido"],
        "email": data["email"],
        "password": data["contrasena"],
        "telefono": data["celular"],
        "rol": data["rol"]
    }

    resultado = usuarios.insert_one(usuario)

    return jsonify({
        "success": True,
        "message": "Usuario creado exitosamente.",
        "id": str(resultado.inserted_id)
    }), 201

if __name__ == "__main__":

    app.run(port=5001, debug=True)