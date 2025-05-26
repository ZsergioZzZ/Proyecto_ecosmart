from flask import Blueprint, request, jsonify
from pymongo import MongoClient
from dotenv import load_dotenv
import os
import re
import random
import smtplib
from email.mime.text import MIMEText


cambiar_contrasena_blueprint = Blueprint('cambiar-contrasena', __name__)

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME")


client = MongoClient(MONGO_URI)
db = client[DB_NAME]
coleccion_usuarios = db["datos_usuarios"]

def validar_password(password):
    return len(password) >= 8 and re.search(r"[A-Z]", password) and re.search(r"\d", password)

@cambiar_contrasena_blueprint.route("/cambiar-contrasena", methods=["POST"])
def cambiar_contrasena():
    data = request.get_json()
    email = data.get("email")
    nueva_contrasena = data.get("nuevaContrasena")
    clave = data.get("clave")

    if not email or not nueva_contrasena or not clave:
        return jsonify({"success": False, "message": "Faltan datos"}), 400

    if not validar_password(nueva_contrasena):
        return jsonify({"success": False, "message": "La contraseña debe tener al menos 8 caracteres, una mayúscula y un número."}), 400

    usuario = coleccion_usuarios.find_one({"email": email})
    if not usuario:
        return jsonify({"success": False, "message": "Correo no encontrado"}), 404

    if usuario["password"] == nueva_contrasena:
        return jsonify({"success": False, "message": "La nueva contraseña no puede ser igual a la anterior."}), 400

    if "clave_verificacion" not in usuario or usuario["clave_verificacion"] != clave:
        return jsonify({"success": False, "message": "Clave de verificación incorrecta"}), 400

    coleccion_usuarios.update_one(
        {"email": email},
        {"$set": {"password": nueva_contrasena}, "$unset": {"clave_verificacion": ""}}
    )

    return jsonify({"success": True, "message": "Contraseña actualizada correctamente"}), 200


def generar_clave_verificacion():
    return str(random.randint(100000, 999999))

def enviar_clave_por_correo(destinatario, clave):
    remitente = os.getenv("EMAIL_FROM")
    password = os.getenv("EMAIL_PASSWORD")
    smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", 587))

    mensaje = MIMEText(f"Tu clave de verificación para cambiar la contraseña es: {clave}")
    mensaje['Subject'] = "Clave de verificación - EcoSmart"
    mensaje['From'] = remitente
    mensaje['To'] = destinatario

    with smtplib.SMTP(smtp_server, smtp_port) as server:
        server.starttls()
        server.login(remitente, password)
        server.send_message(mensaje)

def enviar_clave_por_correo(destinatario, clave):
    remitente = os.getenv("EMAIL_SENDER")
    password = os.getenv("EMAIL_PASSWORD")
    smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", 587))

    mensaje = MIMEText(f"Tu clave de verificación para cambiar la contraseña es: {clave}")
    mensaje['Subject'] = "Clave de verificación - EcoSmart"
    mensaje['From'] = remitente
    mensaje['To'] = destinatario

    with smtplib.SMTP(smtp_server, smtp_port) as server:
        server.starttls()
        server.login(remitente, password)
        server.send_message(mensaje)


@cambiar_contrasena_blueprint.route("/enviar-clave-verificacion", methods=["POST"])
def enviar_clave_verificacion():
    data = request.get_json()
    email = data.get("email")

    if not email:
        return jsonify({"success": False, "message": "Falta el correo."}), 400

    usuario = coleccion_usuarios.find_one({"email": email})
    if not usuario:
        return jsonify({"success": False, "message": "Correo no registrado."}), 404

    clave = generar_clave_verificacion()
    try:
        enviar_clave_por_correo(email, clave)
        coleccion_usuarios.update_one(
            {"email": email},
            {"$set": {"clave_verificacion": clave}}
        )
        return jsonify({"success": True, "message": "Clave enviada al correo."}), 200
    except Exception as e:
        return jsonify({"success": False, "message": f"Error al enviar el correo: {e}"}), 500

