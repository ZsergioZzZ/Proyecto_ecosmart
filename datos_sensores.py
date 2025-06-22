#datos_sensores.py

import os
import time
import json
import datetime
import requests
import re
from dotenv import load_dotenv
from pymongo import MongoClient
from zoneinfo import ZoneInfo

# ----------------------------------------
# Cargar variables de entorno
load_dotenv()

# Variables de conexión
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME")
COLLECTION_SENSORES = os.getenv("COLLECTION_NAME", "sensores")
COLLECTION_DATOS = "datos_sensores" 
CACHE_CLIMA = "clima_cache"
OWM_API_KEY = os.getenv("OWM_API_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_API_URL = os.getenv("OPENROUTER_API_URL")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openai/gpt-3.5-turbo")

# Conexión a MongoDB
client = MongoClient(MONGO_URI)
db = client[DB_NAME]
sensores_col = db[COLLECTION_SENSORES]
datos_col = db[COLLECTION_DATOS]
cache = db[CACHE_CLIMA]

# ----------------------------------------
# Funciones
def obtener_clima(lat, lon):
    registro = cache.find_one({"lat": lat, "lon": lon})

    if registro and time.time() - registro["timestamp"] < 3600:
        print("✅ Usando clima guardado (menos de 1 hora)")
        return registro["temp"], registro["humedad"]

    print("🌐 Consultando OpenWeatherMap...")
    url = f"http://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={OWM_API_KEY}&units=metric"
    response = requests.get(url)

    if response.status_code == 200:
        data = response.json()
        temp = data["main"]["temp"]
        humedad = data["main"]["humidity"]

        cache.update_one(
            {"lat": lat, "lon": lon},
            {"$set": {"temp": temp, "humedad": humedad, "timestamp": time.time()}},
            upsert=True
        )
        return temp, humedad
    else:
        print("❌ Error al obtener clima:", response.text)
        return None, None

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
        response = requests.post(OPENROUTER_API_URL, headers=headers, json=body, timeout=30)

        if response.status_code == 200:
            return response.json()["choices"][0]["message"]["content"]
        else:
            print("Error en OpenRouter:", response.text)
            return None
    except requests.exceptions.ReadTimeout:
        print("La solicitud a OpenRouter demoró demasiado (timeout).")
        return None
    except Exception as e:
        print("Error inesperado al llamar a OpenRouter:", e)
        return None

def limpiar_json_de_respuesta(respuesta):
    try:
        limpio = re.sub(r"```json|```", "", respuesta).strip()
        return json.loads(limpio)
    except json.JSONDecodeError as e:
        print("Error al parsear JSON:", e)
        return None

def generar_y_guardar_dato(sensor):
    parcela = sensor.get("parcela", "Desconocida")
    tipo = sensor.get("tipo")
    ubicacion = sensor.get("ubicacion", {})
    lat = ubicacion.get("lat")
    lon = ubicacion.get("lng")

    print(f"\nGenerando dato para sensor tipo '{tipo}' en parcela '{parcela}'")

    if not all([lat, lon, tipo]):
        print("Sensor incompleto, se omite")
        return

    datos_generados = {}

    if tipo == "Temperatura Ambiente":
        temperatura, _ = obtener_clima(lat, lon)
        if temperatura is None:
            print("No se pudo obtener temperatura.")
            return
        datos_generados = {
            "temperatura": temperatura
        }

    elif tipo == "Humedad del suelo":
        _, humedad = obtener_clima(lat, lon)
        if humedad is None:
            print("No se pudo obtener humedad.")
            return
        datos_generados = {
            "humedad_suelo": humedad
        }


    elif tipo == "Nivel de PH":
        prompt = f"""
        Simula un valor realista y aleatorio para el pH del suelo
        en una parcela llamada {parcela}, ubicada en latitud {lat} y longitud {lon}.
        Entrega solo el JSON:
        {{
          "ph_suelo": número decimal entre 3.5 y 9.5
        }}
        Sin texto adicional.
        """
        respuesta = generar_datos_ia(prompt)
        datos_generados = limpiar_json_de_respuesta(respuesta)

    elif tipo == "Nivel de Nutrientes":
        prompt = f"""
        Simula datos realistas de nutrientes del suelo para una parcela llamada {parcela},
        ubicada en latitud {lat} y longitud {lon}.
        Entrega el resultado en JSON válido con este formato:
        {{
          "nutrientes": {{
            "nitrógeno": número entre 10 y 200,
            "fósforo": número entre 10 y 200,
            "potasio": número entre 10 y 200
          }}
        }}
        No escribas texto adicional.
        """
        respuesta = generar_datos_ia(prompt)
        datos_generados = limpiar_json_de_respuesta(respuesta)

    else:
        print(f"Tipo de sensor '{tipo}' no reconocido. Se omite.")
        return

    if not datos_generados:
        print("No se pudieron generar datos válidos para", tipo)
        return

    documento = {
        "timestamp": datetime.datetime.now(ZoneInfo("America/Santiago")),
        "parcela": parcela,
        "tipo": tipo,
        "ubicacion": {"lat": lat, "lon": lon},
        **datos_generados
    }

    datos_col.insert_one(documento)
    print(f"✅ Dato guardado en 'datos_sensores' para tipo: {tipo}")

# ----------------------------------------
# Simulación continua

if __name__ == "__main__":

    print("▶ Iniciando generador de datos para sensores...")

    while True:
        sensores = list(sensores_col.find())

        if not sensores:
            print("No hay sensores registrados.")
        else:
            for sensor in sensores:
                generar_y_guardar_dato(sensor)

        print("⏳ Esperando 60 segundos para nueva generación...")
        time.sleep(300)
