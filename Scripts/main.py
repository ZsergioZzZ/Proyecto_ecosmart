import random
import time
from datetime import datetime

def generar_datos_sensor():
    return {
        "timestamp": datetime.now(),
        "temperatura": round(random.uniform(15.0, 30.0), 2),   # °C
        "humedad": round(random.uniform(25.0, 85.0), 2),       # %
        "ph": round(random.uniform(5.5, 8.0), 2),               # Escala pH
        "nitrógeno": round(random.uniform(2.0, 4.5), 2),        # %
        "fósforo": round(random.uniform(0.2, 0.5), 2),          # %
        "potasio": round(random.uniform(1.5, 3.0), 2),          # %
        "sensor_id": "SENSOR-001",
        "parcela": "Parcela 1",
        "cultivo": "Tomate"
    }

def simular():
    while True:
        datos = generar_datos_sensor()
        print(f"\n[{datos['timestamp']}] Datos simulados:")
        print(f"  Temperatura: {datos['temperatura']} °C")
        print(f"  Humedad del suelo: {datos['humedad']} %")
        print(f"  Nivel de pH: {datos['ph']}")
        print(f"  Nitrógeno: {datos['nitrógeno']} %")
        print(f"  Fósforo: {datos['fósforo']} %")
        print(f"  Potasio: {datos['potasio']} %")
        print(f"  Sensor ID: {datos['sensor_id']} | Parcela: {datos['parcela']} | Cultivo: {datos['cultivo']}")
        time.sleep(5)

if __name__ == "__main__":
    simular()