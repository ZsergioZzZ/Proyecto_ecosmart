import os
import time
import json
import datetime
import requests
import re
from dotenv import load_dotenv
from pymongo import MongoClient

# ----------------------------------------
# Cargar variables de entorno
load_dotenv()

# Variables de conexion
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME")
COLLECTION_SENSORES = os.getenv("COLLECTION_NAME", "Datos_sensores")
COLLECTION_PARCELAS = os.getenv("COLLECTION_PARCELAS", "parcelas")
OWM_API_KEY = os.getenv("OWM_API_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_API_URL = os.getenv("OPENROUTER_API_URL")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openai/gpt-3.5-turbo")

# Conexion a MongoDB
client = MongoClient(MONGO_URI)
db = client[DB_NAME]
sensores = db[COLLECTION_SENSORES]
cache = db["clima_cache"]
parcelas = db[COLLECTION_PARCELAS]

# ----------------------------------------
# Funciones

def obtener_clima(lat, lon):
    registro = cache.find_one({"lat": lat, "lon": lon})

    if registro:
        if time.time() - registro["timestamp"] < 3600:
            print("Usando clima guardado de MongoDB (1 hora)")
            return registro["temp"]
        else:
            print("Cache encontrado pero expirado, consultando API...")

    url = f"http://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={OWM_API_KEY}&units=metric"
    response = requests.get(url)

    if response.status_code == 200:
        temp = response.json()["main"]["temp"]
        cache.update_one(
            {"lat": lat, "lon": lon},
            {"$set": {"temp": temp, "timestamp": time.time()}},
            upsert=True
        )
        print("Clima obtenido desde la API y cacheado")
        return temp
    else:
        print("Error al obtener clima:", response.text)
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
    response = requests.post(OPENROUTER_API_URL, headers=headers, json=body)

    if response.status_code == 200:
        return response.json()["choices"][0]["message"]["content"]
    else:
        print("Error en OpenRouter:", response.text)
        return None

def limpiar_json_de_respuesta(respuesta):
    try:
        limpio = re.sub(r"```json|```", "", respuesta).strip()
        return json.loads(limpio)
    except json.JSONDecodeError as e:
        print("Error al parsear JSON:", e)
        print("Respuesta completa:", respuesta)
        return None

def generar_y_guardar_dato(parcela, lat, lon):
    print(f"\n🟡 Generando datos para parcela: {parcela}")

    temperatura = obtener_clima(lat, lon)
    if temperatura is None:
        print(" No se pudo obtener temperatura. Abortando generación...")
        return

    prompt = f"""
    Simula datos realistas y aleatorios de sensores agricolas para una parcela llamada {parcela}.
    Entrega el resultado en JSON válido. Incluye:
    - "humedad_suelo": número decimal entre 20 y 80 (%)
    - "ph_suelo": número decimal entre 5.5 y 7.5
    - "nutrientes": un objeto con:
      - "nitrógeno": entre 10 y 200 (ppm)
      - "fósforo": entre 10 y 200 (ppm)
      - "potasio": entre 10 y 200 (ppm)
    Variar los valores en cada respuesta. No escribas texto ni explicación. Solo el JSON.
    """

    datos_ia = generar_datos_ia(prompt)
    datos_sensor = limpiar_json_de_respuesta(datos_ia)

    if not datos_sensor:
        print("Error en generacion IA. No se guardaron los datos.")
        return

    documento = {
        "timestamp": datetime.datetime.now(),
        "parcela": parcela,
        "ubicacion": {"lat": lat, "lon": lon},
        "temperatura": temperatura,
        **datos_sensor
    }

    sensores.insert_one(documento)
    print(f"Dato guardado en MongoDB para parcela: {parcela}")

def obtener_parcelas():
    """
    Consulta todas las parcelas existentes en MongoDB.
    Deben tener 'nombre', 'lat' y 'lon'.
    """
    lista_parcelas = []
    for p in parcelas.find():
        nombre = p.get("nombre")
        lat = p.get("lat")
        lon = p.get("lon")
        if nombre and lat and lon:
            lista_parcelas.append({"nombre": nombre, "lat": lat, "lon": lon})
    return lista_parcelas

# ----------------------------------------
# Simulacion:

if __name__ == "__main__":
    print("Iniciando simulador...")

    while True:
        lista = obtener_parcelas()

        if not lista:
            print("No hay parcelas registradas.")
        else:
            for parcela in lista:
                generar_y_guardar_dato(parcela["nombre"], parcela["lat"], parcela["lon"])

        print("⏳ Esperando 60 segundos para nueva generacion...")
        time.sleep(60)
