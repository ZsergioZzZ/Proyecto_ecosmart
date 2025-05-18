from flask import Flask
from pymongo import MongoClient
from dotenv import load_dotenv
import os
import requests
import random
from datetime import datetime

# Cargar .env
load_dotenv()

# MongoDB
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME")
client = MongoClient(MONGO_URI)
db = client[DB_NAME]
sensores = db["Sensores"]
datos = db["Datos_sensores"]

# OpenWeatherMap API
OWM_API_KEY = os.getenv("OWM_API_KEY")

# OpenRouter IA API
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_API_URL = os.getenv("OPENROUTER_API_URL")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openai/gpt-3.5-turbo")

def obtener_tiempo(lat, lon):
    try:
        url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&units=metric&appid={OWM_API_KEY}"
        response = requests.get(url)
        data = response.json()
        return data["main"]
    except Exception as e:
        print("Error al obtener clima:", e)
        return None

def generar_datos_ia(prompt):
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }
    body = {
        "model": OPENROUTER_MODEL,
        "messages": [{"role": "user", "content": prompt}]
    }

    try:
        response = requests.post(OPENROUTER_API_URL, headers=headers, json=body)
        if response.status_code == 200:
            return response.json()["choices"][0]["message"]["content"]
        else:
            print("Error en OpenRouter:", response.text)
            return None
    except Exception as e:
        print("Excepción al llamar OpenRouter:", e)
        return None

def simular_valor(sensor, clima):
    tipo = sensor["tipo"]
    temp = clima["temp"] if clima else round(random.uniform(15, 30), 1)

    if tipo == "Temperatura Ambiente":
        return temp

    elif tipo == "Humedad del suelo":
        prompt = f"Simula un porcentaje de humedad del suelo para un campo agrícola con temperatura de {temp}°C. Solo responde el número (ej: 56.2)."
        respuesta = generar_datos_ia(prompt)
        try:
            return float(respuesta)
        except:
            return round(random.uniform(20, 80), 1)

    elif tipo == "Nivel de PH":
        prompt = "Simula un valor realista de pH del suelo agrícola. Solo responde el número entre 5.5 y 7.5."
        respuesta = generar_datos_ia(prompt)
        try:
            return float(respuesta)
        except:
            return round(random.uniform(5.5, 7.5), 2)

    elif tipo == "Nivel de Nutrientes":
        prompt = (
            "Simula un conjunto de valores realistas de nutrientes N, P, K en un suelo agrícola fértil. "
            "Devuelve en formato JSON como: {\"n\": 50, \"p\": 30, \"k\": 60}"
        )
        respuesta = generar_datos_ia(prompt)
        try:
            valores = eval(respuesta)
            if isinstance(valores, dict) and all(k in valores for k in ["n", "p", "k"]):
                return valores
        except:
            pass
        # fallback aleatorio
        return {
            "n": random.randint(30, 70),
            "p": random.randint(20, 50),
            "k": random.randint(40, 80)
        }

    return None

def generar_datos():
    sensores_lista = list(sensores.find({}))
    print(f"Total sensores: {len(sensores_lista)}")

    for sensor in sensores_lista:
        ubicacion = sensor.get("ubicacion")
        if not ubicacion:
            continue

        lat = ubicacion.get("lat")
        lng = ubicacion.get("lng")

        clima = obtener_tiempo(lat, lng)
        valor = simular_valor(sensor, clima)

        if valor is not None:
            datos.insert_one({
                "sensor_id": sensor["numero"],
                "tipo": sensor["tipo"],
                "parcela": sensor["parcela"],
                "valor": valor,
                "timestamp": datetime.utcnow()
            })
            print(f"✓ Sensor #{sensor['numero']} ({sensor['tipo']}) registrado.")

if __name__ == "__main__":
    generar_datos()
