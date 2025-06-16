import os
import requests
import smtplib
from email.message import EmailMessage
from dotenv import load_dotenv
from pymongo import MongoClient
import schedule
import time

# Carga variables de entorno
load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME")
OWM_API_KEY = os.getenv("OWM_API_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_API_URL = os.getenv("OPENROUTER_API_URL")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openai/gpt-3.5-turbo")

# Conexión a MongoDB
client = MongoClient(MONGO_URI)
db = client[DB_NAME]
parcelas = db["datos_parcelas"]

# ------------------------
# Función para enviar correos
# ------------------------
def enviar_correo(destinatario: str, asunto: str, contenido: str):
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
        print(f"❌ Error al enviar correo a {destinatario}: {e}")

# ------------------------
# Genera y envía alertas por parcela
# ------------------------
def generar_y_enviar_alertas():
    for p in parcelas.find({}, {"nombre":1, "numero":1, "cultivo":1, "puntos":1, "usuario":1, "_id":0}):
        nombre = p["nombre"]
        numero = p["numero"]
        cultivo = p.get("cultivo", "cultivo")
        usuarios = p.get("usuario", [])
        puntos = p.get("puntos", [])
        if not puntos or not usuarios:
            continue

        # Tomamos el primer punto de la parcela
        lat = puntos[0]["lat"]
        lon = puntos[0]["lng"]

        # Obtener pronóstico 5 días (forecast cada 3h)
        url = (
            f"https://api.openweathermap.org/data/2.5/forecast"
            f"?lat={lat}&lon={lon}&units=metric&appid={OWM_API_KEY}&lang=es"
        )
        resp = requests.get(url, timeout=10).json()
        if "list" not in resp:
            print(f"❌ Error OWM para parcela {nombre} #{numero}: {resp}")
            continue

        # Agrupar por día y calcular min, max y lluvia total
        dias = {}
        for entry in resp["list"]:
            fecha = entry["dt_txt"].split()[0]
            temp_min = entry["main"]["temp_min"]
            temp_max = entry["main"]["temp_max"]
            lluvia = entry.get("rain", {}).get("3h", 0)
            if fecha not in dias:
                dias[fecha] = {"min": temp_min, "max": temp_max, "lluvia": lluvia}
            else:
                dias[fecha]["min"] = min(dias[fecha]["min"], temp_min)
                dias[fecha]["max"] = max(dias[fecha]["max"], temp_max)
                dias[fecha]["lluvia"] += lluvia

        # Tomar solo los próximos 5 días
        dias_ordenados = sorted(dias.items())[:5]

        # Construir pronóstico numerado
        pronostico_lineas = []
        for idx, (fecha, vals) in enumerate(dias_ordenados, start=1):
            linea = (
                f"{fecha}: "
                f"{round(vals['min'],1)}°C–{round(vals['max'],1)}°C, "
                f"lluvia {round(vals['lluvia'],1)} mm"
            )
            pronostico_lineas.append(linea)
        pronostico_texto = "\n".join(pronostico_lineas)

        # Detectar eventos críticos
        eventos = []
        for fecha, vals in dias_ordenados:
            if vals["min"] <= 3:
                eventos.append(f"helada el {fecha} (mín: {round(vals['min'],1)}°C)")
            if vals["lluvia"] >= 10:
                eventos.append(f"lluvia intensa el {fecha} ({round(vals['lluvia'],1)} mm)")
            if vals["max"] >= 32:
                eventos.append(f"calor extremo el {fecha} (máx: {round(vals['max'],1)}°C)")
        total_lluvia = sum(v["lluvia"] for _, v in dias_ordenados)
        if total_lluvia < 3:
            eventos.append("posible sequía: muy poca lluvia en 5 días")

        # Preparar prompt IA
        prompt = (
            f"Eres un asesor técnico agrícola. Analiza este pronóstico para el cultivo de {cultivo} "
            f"en la parcela {nombre} - Parcela {numero}:\n{pronostico_texto}\n\n"
            + (f"Eventos críticos: {', '.join(eventos)}.\n\n" if eventos else "")
            + "De forma clara y concisa, genera 3 recomendaciones prácticas."
        )

        # Llamada a IA
        try:
            ia_resp = requests.post(
                OPENROUTER_API_URL,
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={"model": OPENROUTER_MODEL, "messages":[{"role":"user","content":prompt}]},
                timeout=20
            )
            if ia_resp.status_code == 200:
                recomendaciones = ia_resp.json()["choices"][0]["message"]["content"]
            else:
                recomendaciones = "No se pudo obtener recomendaciones IA."
        except Exception as e:
            print("❌ Error IA:", e)
            recomendaciones = "No se pudo obtener recomendaciones IA."

        # Construir asunto y contenido del correo
        asunto = f"Alerta pronóstico – {nombre} #{numero}"
        contenido = [
            f"Parcela: {nombre} - Parcela {numero}",
            f"Cultivo: {cultivo}",
            "",
            "Pronóstico 5 días:",
            pronostico_texto
        ]
        if eventos:
            contenido += ["", "Eventos críticos:"] + [f"- {e}" for e in eventos]
        contenido += ["", "Recomendaciones:", recomendaciones]
        contenido = "\n".join(contenido)

        # Enviar a cada usuario asociado
        for dest in usuarios:
            enviar_correo(dest, asunto, contenido)


if __name__ == "__main__":
    schedule.every().day.at("11:19").do(generar_y_enviar_alertas)
    print("🤖 Scheduler iniciado, esperando la hora programada (10:00)...")

    while True:
        schedule.run_pending()
        time.sleep(60)
