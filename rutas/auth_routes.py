from flask import Blueprint, request, jsonify
import os
from pymongo import MongoClient
import random
import string
import smtplib
from email.mime.text import MIMEText
from dotenv import load_dotenv
import requests

auth_blueprint=Blueprint('auth', __name__)

load_dotenv()

# Conexión a la base de datos
client = MongoClient(os.getenv("MONGO_URI"))
db = client[os.getenv("DB_NAME")]
usuarios_collection = db[os.getenv("COLLECTION_USUARIOS", "datos_usuarios")]

# Email
EMAIL_SENDER = os.getenv("EMAIL_SENDER")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD")

# Funciones auxiliares (en el mismo archivo)
def generar_clave_temporal(longitud=6):
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=longitud))

def enviar_clave_por_correo(destinatario, clave):
    mensaje = MIMEText(f"Tu clave de acceso temporal para técnicos es: {clave}")
    mensaje["Subject"] = "Clave de acceso técnico - EcoSmart"
    mensaje["From"] = EMAIL_SENDER
    mensaje["To"] = destinatario

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as servidor:
            servidor.login(EMAIL_SENDER, EMAIL_PASSWORD)
            servidor.send_message(mensaje)
    except Exception as e:
        print(f"Error al enviar correo: {e}")

def validar_email(email):
    return '@' in email and '.' in email.split('@')[-1]

def validar_telefono(telefono):
    return telefono.isdigit() and len(telefono) == 9 and telefono.startswith("9")

def validar_rol(rol):
    return rol.lower() in {"agricultor", "agronomo", "tecnico"}

def validar_password(password):
    return (
        len(password) >= 8 and
        any(c.isdigit() for c in password) and
        any(c.isupper() for c in password)
    )


# Rutas

@auth_blueprint.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get("email", "").strip()
    password = data.get("password", "").strip()

    usuario = usuarios_collection.find_one({"email": email})
    if not usuario:
        return jsonify(success=False, message="Email no registrado")
    if usuario["password"] != password:
        return jsonify(success=False, message="Contraseña incorrecta")

    if usuario["rol"] == "tecnico":
        clave_temporal = generar_clave_temporal()
        usuarios_collection.update_one(
            {"_id": usuario["_id"]},
            {"$set": {"clave_tecnico": clave_temporal}}
        )
        enviar_clave_por_correo(usuario["email"], clave_temporal)
        return jsonify(success=True, rol="tecnico", clave_enviada=True, nombre=usuario["nombre"], email=usuario["email"] )

    return jsonify(success=True, rol=usuario["rol"], nombre=usuario["nombre"], email=usuario["email"] )

@auth_blueprint.route('/verificar-clave', methods=['POST'])
def verificar_clave():
    data = request.get_json()
    email = data.get("email", "").strip()
    clave_ingresada = data.get("clave", "").strip()

    usuario = usuarios_collection.find_one({"email": email})
    if not usuario:
        return jsonify(success=False, message="Usuario no encontrado")

    if usuario.get("clave_tecnico") != clave_ingresada:
        return jsonify(success=False, message="Clave incorrecta")

    return jsonify(success=True)


#REGISTRAR USUARIO

@auth_blueprint.route("/verificar-email-real", methods=["POST"])
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


@auth_blueprint.route("/crear-cuenta", methods=["POST"])
def crear_usuario():
    data = request.get_json()

    # Validaciones
    if not validar_email(data["email"]):
        return jsonify({"success": False, "message": "Email inválido."}), 400

    if usuarios_collection.find_one({"email": data["email"]}):
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

    resultado = usuarios_collection.insert_one(usuario)

    return jsonify({
        "success": True,
        "message": "Usuario creado exitosamente.",
        "id": str(resultado.inserted_id)
    }), 201
#