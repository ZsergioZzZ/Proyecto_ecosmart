from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import random
import string
from dotenv import load_dotenv
from pymongo import MongoClient
import smtplib
from email.mime.text import MIMEText

app = Flask(__name__)
CORS(app)  #  Evita el error de fetch por CORS

# Configuración de entorno
load_dotenv()
client = MongoClient(os.getenv("MONGO_URI"))
db = client[os.getenv("DB_NAME")]
usuarios_collection = db[os.getenv("COLLECTION_USUARIOS", "datos_usuarios")]

EMAIL_SENDER = os.getenv("EMAIL_SENDER")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD")

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

@app.route('/login', methods=['POST']) #ENDPOINT de Read para el login
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
        return jsonify(success=True, rol="tecnico", clave_enviada=True, nombre=usuario["nombre"])

    return jsonify(success=True, rol=usuario["rol"], nombre=usuario["nombre"])

@app.route('/verificar-clave', methods=['POST'])
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








if __name__ == '__main__':
    app.run(port=5000, debug=True)