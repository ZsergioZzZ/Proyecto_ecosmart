from pymongo import MongoClient
from datetime import datetime
from dotenv import load_dotenv
import os
import time
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

def enviar_correo(destinatario, asunto, contenido):
    remitente = os.getenv("EMAIL_SENDER")
    contrasena = os.getenv("EMAIL_PASSWORD")

    if not remitente or not contrasena:
        print("❌ EMAIL_SENDER o EMAIL_PASSWORD no están definidos en .env")
        return

    mensaje = EmailMessage()
    mensaje["Subject"] = asunto
    mensaje["From"] = remitente
    mensaje["To"] = destinatario
    mensaje.set_content(contenido)

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
            smtp.login(remitente, contrasena)
            smtp.send_message(mensaje)
            print(f"📧 Correo enviado a {destinatario}")
    except Exception as e:
        print(f"❌ Error al enviar correo: {e}")

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

def extraer_valor_unico(x):
    if isinstance(x, list) and x:
        return x[0]
    return x

def evaluar_y_guardar(alerta, sensor_general, sensor_nutriente, valor, umbral_bajo, umbral_alto, desc_bajo, desc_alto, timestamp_dato):
    # Asegura que no sean listas
    valor = extraer_valor_unico(valor)
    umbral_bajo = extraer_valor_unico(umbral_bajo)
    umbral_alto = extraer_valor_unico(umbral_alto)

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

    correo = alerta.get("correo", [])
    correo_app = alerta.get("correo_app", [])

    if isinstance(correo, str):
        correo = [correo]
    elif correo is None:
        correo = []
    if isinstance(correo_app, str):
        correo_app = [correo_app]
    elif correo_app is None:
        correo_app = []

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
        "correo": correo,             
        "correo_app": correo_app      
    }

    alertas_activas.insert_one(alerta_nueva)

    if "correo" in alerta.get("notificaciones", []):
        for destinatario in correo:
            if not destinatario: continue
            mensaje_correo = f"""\
            Estimado(a),

            Le informamos que se ha activado una alerta en el sistema de monitoreo para la siguiente parcela:

            🧭 Parcela: {alerta['parcela']}
            📍 Sensor: {sensor_nutriente or sensor_general}
            📊 Valor detectado: {valor}

            ℹ️ Descripción: {descripcion}

            Por favor, revise el estado de la parcela a la brevedad y tome las acciones correspondientes en caso de ser necesario.

            —
            Este es un mensaje automático del sistema EcoSmart.
            No responda a este correo.
            """
            enviar_correo(destinatario, f"⚠️ Alerta activa: {alerta['nombre_alerta']}", mensaje_correo)

if __name__ == "__main__":
    while True:
        verificar_alertas()
        print("[🕐] Esperando 60 segundos para la siguiente verificación...\n")
        time.sleep(60) 