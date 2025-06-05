from pymongo import MongoClient
from datetime import datetime
from dotenv import load_dotenv
import os
import time
import subprocess
import smtplib
from email.message import EmailMessage

# Cargar variables de entorno
load_dotenv()

client = MongoClient(os.getenv("MONGO_URI"))
db = client[os.getenv("DB_NAME")]
alertas = db["alertas"]
datos_sensores = db["datos_sensores"]
alertas_activas = db["alertas_activas"]

#------------------------
# Log para enviar correos
#------------------------

#def enviar_correo():

#------------------------
#------------------------


def verificar_alertas():
    print("\n🔍 Verificando sensores...\n")
    for alerta in alertas.find():
        parcela = alerta["parcela"]
        sensor = alerta["sensor"].strip().lower()

        dato = datos_sensores.find_one(
            {"parcela": parcela, "tipo": {"$regex": f"^{sensor}$", "$options": "i"}},
            sort=[("timestamp", -1)]
        )

        if not dato:
            print(f"❌ No se encontró dato reciente para {sensor} en {parcela}")
            continue

        timestamp_dato = dato["timestamp"]

        if sensor == "nivel de nutrientes":
            claves = {"nitrógeno": "n", "fósforo": "p", "potasio": "k"}
            nutrientes = dato.get("nutrientes", {})

            for nombre_real, clave_alerta in claves.items():
                valor = nutrientes.get(nombre_real)
                limites = alerta.get("nutrientes", {}).get(clave_alerta, {})

                ya_guardada = alertas_activas.find_one({
                    "parcela": parcela,
                    "sensor": sensor,
                    "sensor_nutriente": clave_alerta.upper(),
                    "timestamp_lectura": timestamp_dato
                })

                if ya_guardada:
                    print(f"✅ {clave_alerta.upper()} en {parcela} ya fue verificado (timestamp: {timestamp_dato})")
                    continue

                evaluar_y_guardar(alerta, sensor, clave_alerta.upper(), valor,
                                  limites.get("umbral_bajo"),
                                  limites.get("umbral_alto"),
                                  limites.get("descripcion_bajo"),
                                  limites.get("descripcion_alto"),
                                  timestamp_dato)
        else:
            campo_valor = {
                "temperatura ambiente": "temperatura",
                "humedad del suelo": "humedad_suelo",
                "nivel de ph": "ph_suelo"
            }.get(sensor)

            if not campo_valor:
                print(f"⚠️ Sensor no reconocido: {sensor}")
                continue

            ya_guardada = alertas_activas.find_one({
                "parcela": parcela,
                "sensor": sensor,
                "timestamp_lectura": timestamp_dato
            })

            if ya_guardada:
                print(f"✅ {sensor} en {parcela} ya fue verificado (timestamp: {timestamp_dato})")
                continue

            valor = dato.get(campo_valor)
            evaluar_y_guardar(alerta, sensor, None, valor,
                              alerta.get("umbral_bajo"),
                              alerta.get("umbral_alto"),
                              alerta.get("descripcion_bajo"),
                              alerta.get("descripcion_alto"),
                              timestamp_dato)

def evaluar_y_guardar(alerta, sensor_general, sensor_nutriente, valor, umbral_bajo, umbral_alto, desc_bajo, desc_alto, timestamp_dato):
    if valor is None or umbral_bajo is None or umbral_alto is None:
        print(f"⚠️ Valor o umbrales faltantes para {sensor_nutriente or sensor_general}")
        return

    if valor > umbral_alto:
        descripcion = desc_alto or "Exceso detectado"
    elif valor < umbral_bajo:
        descripcion = desc_bajo or "Deficiencia detectada"
    else:
        print(f"✅ {sensor_nutriente or sensor_general} OK. Valor: {valor} dentro del rango [{umbral_bajo}, {umbral_alto}]")
        return

    print(f"⚠️ ALERTA ACTIVADA: {sensor_nutriente or sensor_general} fuera de rango ({valor}) → {descripcion}")

    alerta_nueva = {
        "nombre_alerta": alerta["nombre_alerta"],
        "parcela": alerta["parcela"],
        "sensor": sensor_general,
        "sensor_nutriente": sensor_nutriente,
        "valor_detectado": valor,
        "umbral_bajo": umbral_bajo,
        "umbral_alto": umbral_alto,
        "descripcion": descripcion,
        "timestamp_lectura": timestamp_dato,
        "timestamp_alerta": datetime.utcnow(),
        "estado": "Activa",
        "notificaciones": alerta.get("notificaciones", []),
        "correo": alerta.get("correo"),
        "correo_app": alerta.get("correo_app")
    }

    alertas_activas.insert_one(alerta_nueva)

    if "correo" in alerta.get("notificaciones", []) and alerta.get("correo"):
        #enviar_correo()
        #Aqui va la función para enviar el correo
        print(f"📧 Notificación enviada a {alerta['correo']}")

    if "app" in alerta.get("notificaciones", []) and alerta.get("correo_app"):
        print(f"📱 Notificación enviada a la app para {alerta['correo_app']}")

if __name__ == "__main__":
    while True:
        verificar_alertas()
        print("[🕐] Esperando 60 segundos para la siguiente verificación...\n")
        time.sleep(60)
