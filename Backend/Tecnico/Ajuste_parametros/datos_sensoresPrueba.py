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

# Variables de conexión
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME")
COLLECTION_SENSORES = os.getenv("COLLECTION_NAME", "sensores")
COLLECTION_DATOS = "datos_sensores2" 
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
parametros_ajuste = db["Parametros_ajuste"]


# ----------------------------------------
# Funciones
def obtener_parametros(tipo, parcela):
    doc = parametros_ajuste.find_one({"tipo": tipo, "parcela": parcela})
    return doc["valores"] if doc and "valores" in doc else None


def obtener_clima(lat, lon):
    registro = cache.find_one({"lat": lat, "lon": lon})

    if registro and time.time() - registro["timestamp"] < 3600:
        print(" Usando clima guardado (menos de 1 hora)")
        return registro["temp"]

    print(" Consultando OpenWeatherMap...")
    url = f"http://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={OWM_API_KEY}&units=metric"
    response = requests.get(url)

    if response.status_code == 200:
        temp = response.json()["main"]["temp"]
        cache.update_one(
            {"lat": lat, "lon": lon},
            {"$set": {"temp": temp, "timestamp": time.time()}},
            upsert=True
        )
        return temp
    else:
        print(" Error al obtener clima:", response.text)
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
    numero = sensor.get("numero")
    ubicacion = sensor.get("ubicacion", {})
    lat = ubicacion.get("lat")
    lon = ubicacion.get("lng")

    params = obtener_parametros(tipo, parcela)  # ✅ ahora sí funciona

    print(f"\nGenerando dato para sensor tipo '{tipo}' en parcela '{parcela}'")

    if not all([lat, lon, tipo]):
        print("Sensor incompleto, se omite")
        return

    datos_generados = {}

    if tipo == "Temperatura Ambiente":
        temperatura = obtener_clima(lat, lon)
        if temperatura is None:
            print("No se pudo obtener temperatura.")
            return
        datos_generados = {
            "temperatura": temperatura
        }

    elif tipo == "Humedad del suelo":
        if params and "humMin" in params and "humMax" in params:
            prompt = f"""
            Simula un valor realista y aleatorio para la humedad del suelo (%)
            en una parcela llamada {parcela}, ubicada en latitud {lat} y longitud {lon}.
            Entrega solo el JSON:
            {{
              "humedad_suelo": número decimal entre {params['humMin']} y {params['humMax']}
            }}
            Sin texto adicional.
            """
        else:
            prompt = f"""
            Simula un valor realista y aleatorio para la humedad del suelo (%)
            en una parcela llamada {parcela}, ubicada en latitud {lat} y longitud {lon}.
            Entrega solo el JSON:
            {{
              "humedad_suelo": número decimal entre 20 y 80
            }}
            Sin texto adicional.
            """
        respuesta = generar_datos_ia(prompt)
        datos_generados = limpiar_json_de_respuesta(respuesta)

    elif tipo == "Nivel de PH":
        if params and "phMin" in params and "phMax" in params:
            prompt = f"""
            Simula un valor realista y aleatorio para el pH del suelo
            en una parcela llamada {parcela}, ubicada en latitud {lat} y longitud {lon}.
            Entrega solo el JSON:
            {{
              "ph_suelo": número decimal entre {params['phMin']} y {params['phMax']}
            }}
            Sin texto adicional.
            """
        else:
            prompt = f"""
            Simula un valor realista y aleatorio para el pH del suelo
            en una parcela llamada {parcela}, ubicada en latitud {lat} y longitud {lon}.
            Entrega solo el JSON:
            {{
              "ph_suelo": número decimal entre 5.5 y 7.5
            }}
            Sin texto adicional.
            """
        respuesta = generar_datos_ia(prompt)
        datos_generados = limpiar_json_de_respuesta(respuesta)

    elif tipo == "Nivel de Nutrientes":
        if params and all(k in params for k in ["nMin", "nMax", "pMin", "pMax", "kMin", "kMax"]):
            prompt = f"""
            Simula datos realistas de nutrientes del suelo para una parcela llamada {parcela},
            ubicada en latitud {lat} y longitud {lon}.
            Entrega el resultado en JSON válido con este formato:
            {{
              "nutrientes": {{
                "nitrógeno": número entre {params['nMin']} y {params['nMax']},
                "fósforo": número entre {params['pMin']} y {params['pMax']},
                "potasio": número entre {params['kMin']} y {params['kMax']}
              }}
            }}
            No escribas texto adicional.
            """
        else:
            prompt = f"""
            Simula datos realistas de nutrientes del suelo para una parcela llamada {parcela},
            ubicada en latitud {lat} y longitud {lon}.
            Entrega el resultado en JSON válido con este formato:
            {{
              "nutrientes": {{
                "nitrógeno": número entre 30 y 70,
                "fósforo": número entre 20 y 50,
                "potasio": número entre 40 y 80
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
        "timestamp": datetime.datetime.now(),
        "parcela": parcela,
        "tipo": tipo,
        "numero": numero,
        "ubicacion": {"lat": lat, "lon": lon},
        **datos_generados
    }

    datos_col.insert_one(documento)
    print(f" Dato guardado en 'datos_sensores' para tipo: {tipo}")

# ----------------------------------------
# Simulación continua

if __name__ == "__main__":
    print(" Iniciando generador de datos para sensores...")

    while True:
        sensores = list(sensores_col.find())

        if not sensores:
            print("No hay sensores registrados.")
        else:
            for sensor in sensores:
                generar_y_guardar_dato(sensor)

        print(" Esperando 30 segundos para nueva generación...")
        time.sleep(30)
