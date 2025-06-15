from flask import Blueprint, request, jsonify
import os, requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()
# Configuración básica
listado_parcelas_blueprint = Blueprint('listado_parcelas', __name__)
client = MongoClient(os.getenv("MONGO_URI"))
db = client[os.getenv("DB_NAME")]
parcelas = db["datos_parcelas"]
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_API_URL = os.getenv("OPENROUTER_API_URL")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openai/gpt-3.5-turbo")
OWM_API_KEY = os.getenv("OWM_API_KEY")

prediccion_blueprint = Blueprint("prediccion", __name__)

@prediccion_blueprint.route("/api/agronomo/parcelas", methods=["GET"])
def listar_parcelas_agronomo():
    correo = request.args.get("correo")
    filtro = {}
    if correo:
        filtro = {"usuario": correo}  # Filtra donde el correo esté en el array usuario
    resultados = parcelas.find(filtro, {"nombre": 1, "numero": 1, "cultivo": 1, "puntos": 1, "_id": 0})
    lista = []
    for p in resultados:
        punto = p.get("puntos", [])
        punto_central = punto[0] if punto else {"lat": None, "lng": None}
        lista.append({
            "nombre": p["nombre"],
            "numero": p["numero"],
            "cultivo": p.get("cultivo", "Desconocido"),
            "lat": punto_central.get("lat"),
            "lon": punto_central.get("lng")
        })
    return jsonify(lista)


@prediccion_blueprint.route("/api/agronomo/prediccion", methods=["GET"])
def obtener_prediccion_parcela():
    lat = request.args.get("lat")
    lon = request.args.get("lon")
    cultivo = request.args.get("cultivo", "cultivo")

    if not lat or not lon:
        return jsonify({"error": "Faltan parámetros de ubicación"}), 400

    # Pronóstico extendido OWM (máx. 5 días hacia adelante, cada 3 horas)
    url = f"https://api.openweathermap.org/data/2.5/forecast?lat={lat}&lon={lon}&units=metric&appid={OWM_API_KEY}&lang=es"
    owm = requests.get(url).json()
    if "list" not in owm:
        return jsonify({"error": "Error consultando OpenWeatherMap", "detalle": owm}), 500

    # Agrupar por día, tomar el mínimo y máximo de cada día y lluvia acumulada
    dias = {}
    eventos_criticos = []
    detalles_bloques = {}  
    for entry in owm["list"]:
        fecha = entry["dt_txt"].split(" ")[0]
        hora = entry["dt_txt"].split(" ")[1][:5]  # "HH:MM"
        temp = entry["main"]["temp"]
        temp_min = entry["main"]["temp_min"]
        temp_max = entry["main"]["temp_max"]
        lluvia = entry.get("rain", {}).get("3h", 0)
        desc = entry["weather"][0]["description"]
        icon = entry["weather"][0]["icon"]
        
        # Si la fecha no existe en detalles_bloques, la creas
        if fecha not in detalles_bloques:
            detalles_bloques[fecha] = []
        detalles_bloques[fecha].append({
            "hora": hora,
            "temp": round(temp, 1),
            "temp_min": round(temp_min, 1),
            "temp_max": round(temp_max, 1),
            "lluvia": round(lluvia, 1),
            "desc": desc,
            "icon": icon
        })

        # Agrupación diaria igual que antes
        if fecha not in dias:
            dias[fecha] = {
                "min": temp_min,
                "max": temp_max,
                "lluvia": lluvia,
                "desc": [desc],
                "icon": icon,
            }
        else:
            dias[fecha]["min"] = min(dias[fecha]["min"], temp_min)
            dias[fecha]["max"] = max(dias[fecha]["max"], temp_max)
            dias[fecha]["lluvia"] += lluvia
            dias[fecha]["desc"].append(desc)


    # Ordenar y tomar los próximos 7 días (tantos como existan)
    dias_ordenados = sorted(dias.items())[:7]

    pronostico = [
        {
            "dia": d[0],
            "min": round(d[1]["min"], 1),
            "max": round(d[1]["max"], 1),
            "lluvia": round(d[1]["lluvia"], 1),
            "desc": max(set(d[1]["desc"]), key=d[1]["desc"].count),
            "icon": d[1].get("icon", "01d"), 
            "bloques": detalles_bloques[d[0]] 
        }
        for d in dias_ordenados
    ]


    # Detectar eventos críticos en todos los días mostrados
    for p in pronostico:
        if p["min"] <= 3:
            eventos_criticos.append(f"Posible helada el {p['dia']} (mínima: {p['min']}°C)")
        if p["lluvia"] >= 10:
            eventos_criticos.append(f"Lluvia intensa el {p['dia']} ({p['lluvia']}mm total)")
        if p["max"] >= 32:
            eventos_criticos.append(f"Calor extremo el {p['dia']} (máxima: {p['max']}°C)")

    #Detección de posible sequía
    total_lluvia = sum(p["lluvia"] for p in pronostico)
    if total_lluvia < 3:
        eventos_criticos.append("Posible sequía: muy poca lluvia prevista en la próxima semana")

    # Recomendaciones IA
    prompt = (
        f"Eres un asesor técnico agrícola. Analiza el siguiente pronóstico para el cultivo de {cultivo}: "
        + ", ".join([
            f"{p['dia']}: {p['min']}°C-{p['max']}°C, lluvia {p['lluvia']}mm, {p['desc']}"
            for p in pronostico
        ])
        + f". Eventos críticos: {', '.join(eventos_criticos) if eventos_criticos else 'Ninguno'}."
        + " Resume en máximo 3 recomendaciones técnicas y prácticas para el manejo del cultivo. Sé claro y conciso, responde solo la lista."
    )
    try:
        res_ia = requests.post(
            OPENROUTER_API_URL,
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": OPENROUTER_MODEL,
                "messages": [{"role": "user", "content": prompt}]
            },
            timeout=30
        )
        if res_ia.status_code == 200:
            recomendaciones = res_ia.json()["choices"][0]["message"]["content"]
        else:
            recomendaciones = "No se pudo obtener recomendaciones IA."
    except Exception as ex:
        print("Error IA:", ex)
        recomendaciones = "No se pudo obtener recomendaciones IA."

    return jsonify({
        "pronostico": pronostico,
        "eventos_criticos": eventos_criticos,
        "recomendaciones": recomendaciones
    })
