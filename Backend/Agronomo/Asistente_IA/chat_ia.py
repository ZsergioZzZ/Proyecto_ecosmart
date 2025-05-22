
from pymongo import MongoClient
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import requests
import os
from dotenv import load_dotenv
import uuid

# Cargar variables de entorno desde .env
load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_API_URL = os.getenv("OPENROUTER_API_URL")
MONGO_URI = os.getenv("MONGO_URI")

client = MongoClient(MONGO_URI)
db = client["EcoSmart"]
conversaciones_collection = db["conversaciones_ia"]

app = Flask(__name__)
CORS(app)

@app.route("/consulta", methods=["POST"])
@app.route("/consulta", methods=["POST"])
def consulta():
    datos = request.json
    pregunta = datos.get("pregunta")
    modelo = datos.get("modelo", "gpt-3.5-turbo")
    chat_id = datos.get("chat_id")
    nombre_chat = datos.get("nombre_chat")

    if not pregunta:
        return jsonify({"error": "La pregunta es requerida"}), 400

    if not chat_id:
        chat_id = str(uuid.uuid4())

    # Recuperar historial de la conversación si ya existe
    mensajes_previos = list(conversaciones_collection.find(
        {"chat_id": chat_id}).sort("fecha", 1))

    # Construir mensajes con rol
    mensajes = [
        {
            "role": "system",
            "content": "Eres un asistente experto en agricultura. Solo debes responder preguntas relacionadas con agricultura, cultivos, riego, fertilización, enfermedades de plantas, planificación agrícola, suelos, sensores o técnicas agrícolas. Si te llegan a hacer una pregunta que no es sobre agricultura, dile que solo puedes ayudar con temas agrícolas."
        }
    ]

    # Añadir mensajes previos (si existen)
    for m in mensajes_previos:
        mensajes.append({"role": "user", "content": m["pregunta"]})
        mensajes.append({"role": "assistant", "content": m["respuesta"]})

    # Añadir la nueva pregunta del usuario
    mensajes.append({"role": "user", "content": pregunta})

    # Preparar solicitud a OpenRouter
    payload = {
        "model": modelo,
        "messages": mensajes
    }

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }

    response = requests.post(OPENROUTER_API_URL, headers=headers, json=payload)

    if response.status_code != 200:
        return jsonify({"error": "Error al consultar la IA"}), 500

    respuesta = response.json()["choices"][0]["message"]["content"]

    # Guardar en la base de datos
    conversaciones_collection.insert_one({
        "chat_id": chat_id,
        "pregunta": pregunta,
        "respuesta": respuesta,
        "modelo": modelo,
        "fecha": datetime.now(),
        "nombre_chat": nombre_chat
    })

    return jsonify({"respuesta": respuesta, "chat_id": chat_id})


@app.route("/historial_chats", methods=["GET"])
def historial_chats():
    chats = conversaciones_collection.aggregate([
        {"$sort": {"fecha": -1}},
        {"$group": {
            "_id": "$chat_id",
            "ultima_fecha": {"$first": "$fecha"},
            "nombre_chat": {"$first": "$nombre_chat"}
        }},
        {"$sort": {"ultima_fecha": -1}}
    ])
    return jsonify([
        {"chat_id": chat["_id"], "nombre_chat": chat.get("nombre_chat")}
        for chat in chats
    ])

@app.route("/historial/<chat_id>", methods=["GET"])
def historial_chat(chat_id):
    historial = conversaciones_collection.find({"chat_id": chat_id}).sort("fecha", 1)
    resultado = [{"pregunta": c["pregunta"], "respuesta": c["respuesta"]} for c in historial]
    return jsonify(resultado)

@app.route("/eliminar_chat/<chat_id>", methods=["DELETE"])
def eliminar_chat(chat_id):
    result = conversaciones_collection.delete_many({"chat_id": chat_id})
    return jsonify({"eliminado": result.deleted_count})

@app.route("/renombrar_chat/<chat_id>", methods=["PATCH"])
def renombrar_chat(chat_id):
    datos = request.json
    nuevo_nombre = datos.get("nombre_chat")
    if not nuevo_nombre:
        return jsonify({"error": "Falta el nuevo nombre"}), 400

    result = conversaciones_collection.update_many(
        {"chat_id": chat_id},
        {"$set": {"nombre_chat": nuevo_nombre}}
    )
    return jsonify({"modificados": result.modified_count, "nombre_chat": nuevo_nombre})

if __name__ == "__main__":
    app.run(debug=True)
