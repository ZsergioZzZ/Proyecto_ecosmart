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
parametros_ajuste = db["Parametros_ajuste"]

# OpenWeatherMap API
OWM_API_KEY = os.getenv("OWM_API_KEY")

# OpenRouter IA API
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_API_URL = os.getenv("OPENROUTER_API_URL")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openai/gpt-3.5-turbo")

def obtener_tiempo(lat, lon):
    try:
        url = "https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&units=metric&appid={OWM_API_KEY}"
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

def obtener_parametros(tipo, parcela):
    doc = parametros_ajuste.find_one({"tipo": tipo, "parcela": parcela})
    return doc["valores"] if doc and "valores" in doc else None

def simular_valor(sensor, clima):
    tipo = sensor["tipo"]
    parcela = sensor["parcela"]
    temp = clima["temp"] if clima else round(random.uniform(15, 30), 1)

    # Obtener parámetros ajustados por tipo + parcela
    params = obtener_parametros(tipo, parcela)

    if tipo == "Temperatura Ambiente":
        if params:
            return round(random.uniform(params["min"], params["max"]), 1)
        return temp

    elif tipo == "Humedad del suelo":
        if params:
            return round(random.uniform(params["humMin"], params["humMax"]), 1)
        prompt = f"Simula un porcentaje de humedad del suelo para un campo agrícola con temperatura de {temp}°C. Solo responde el número (ej: 56.2)."
        respuesta = generar_datos_ia(prompt)
        try:
            return float(respuesta)
        except:
            return round(random.uniform(20, 80), 1)

    elif tipo == "Nivel de PH":
        if params:
            return round(random.uniform(params["phMin"], params["phMmax"]), 2)
        prompt = "Simula un valor realista de pH del suelo agrícola. Solo responde el número entre {phMin} y {phMax}."
        respuesta = generar_datos_ia(prompt)
        try:
            return float(respuesta)
        except:
            return round(random.uniform(5.5, 7.5), 2)

    elif tipo == "Nivel de Nutrientes":
        if params and all(k in params for k in ["nMin", "nMax", "pMin", "pMax", "kMin", "kMax"]):
            return {
            "n": random.randint(params["nMin"], params["nMax"]),
            "p": random.randint(params["pMin"], params["pMax"]),
            "k": random.randint(params["kMin"], params["kMax"])
        }
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
            print(f"✓ Sensor #{sensor['numero']} ({sensor['tipo']}) en parcela '{sensor['parcela']}' registrado.")

if __name__ == "__main__":
    generar_datos()
