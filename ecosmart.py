# ecosmart.py

import os
import sys
import signal
import subprocess
from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

sys.stdout.reconfigure(encoding='utf-8')

# ----------------------------------------
# Cargar variables de entorno para la app
# ----------------------------------------
load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME   = os.getenv("DB_NAME")

# ----------------------------------------
# Inicializar Flask y blueprints
# ----------------------------------------
app = Flask(__name__)
CORS(app)

# Aquí van tus imports de blueprints, p. ej.:
from rutas.auth_routes import auth_blueprint
from Backend.Tecnico.Configuracion_sistema.Agregar_parcela.parcelas import agregar_parcelas_blueprint
from Backend.Tecnico.Configuracion_sistema.Agregar_sensor.sensores import agregar_sensores_blueprint
from Backend.Tecnico.Configuracion_sistema.Historial.historial import historial_tecnico_blueprint
from Backend.Tecnico.Configuracion_sistema.Modificar_eliminar.modificar_eliminar_parcala_sensor import modificar_eliminar_blueprint
from Backend.Agronomo.Analisis_datos.datos import analisis_datos_blueprint
from Backend.Agronomo.Asistente_IA.chat_ia import chat_ia_blueprint
from Backend.Agricultor.Monitoreo_de_Cultivos.Datos_meteorologicos.datos_meteorologicos import datos_meteo_blueprint
from Backend.Agricultor.Monitoreo_de_Cultivos.Sensores.sensores import sensores_moni_cultivos_blueprint
from Backend.Usuario.cambiar_contrasena import cambiar_contrasena_blueprint
from Backend.Tecnico.Usuarios.usuarios import cambiar_usuario_tecnico_blueprint
from Backend.Agronomo.Asistente_IA.recomendacion import sensores_bp
from Backend.Tecnico.Configuracion_de_alertas.configurar_alerta import configurar_umbrales_alerta_blueprint
from Backend.Tecnico.Configuracion_de_alertas.notificaciones_app import notificaciones_blueprint
from Backend.Agronomo.Prediccion_y_alertas.prediccion import prediccion_blueprint
from Backend.Agricultor.Analisis_de_riego.analisis_riego import analisis_riego_blueprint

# Registrar todos los blueprints
app.register_blueprint(auth_blueprint)
app.register_blueprint(agregar_parcelas_blueprint)
app.register_blueprint(agregar_sensores_blueprint)
app.register_blueprint(historial_tecnico_blueprint)
app.register_blueprint(modificar_eliminar_blueprint)
app.register_blueprint(analisis_datos_blueprint)
app.register_blueprint(chat_ia_blueprint)
app.register_blueprint(datos_meteo_blueprint)
app.register_blueprint(sensores_moni_cultivos_blueprint)
app.register_blueprint(cambiar_contrasena_blueprint)
app.register_blueprint(cambiar_usuario_tecnico_blueprint)
app.register_blueprint(sensores_bp)
app.register_blueprint(configurar_umbrales_alerta_blueprint)
app.register_blueprint(notificaciones_blueprint)
app.register_blueprint(prediccion_blueprint)
app.register_blueprint(analisis_riego_blueprint)

# ----------------------------------------
# Variables para procesos hijos
# ----------------------------------------

generador_proc = None
notificacion_proc = None
pronostico_proc = None

# ----------------------------------------
# Función para iniciar generador de datos
# ----------------------------------------
def iniciar_generador():
    ruta = os.path.join(os.path.dirname(__file__), "datos_sensores.py")
    if not os.path.exists(ruta):
        print(f"‼️ Generador: no se encontró '{ruta}'")
        return None
    try:
        p = subprocess.Popen([sys.executable, ruta], cwd=os.path.dirname(__file__))
        print(f"▶ Generador de datos iniciado (PID={p.pid})")
        return p
    except Exception as e:
        print(f"‼️ Error generador: {e}")
        return None

# ----------------------------------------
# Función para iniciar notificaciones de alertas
# ----------------------------------------
def iniciar_notificacion():
    ruta = os.path.join(os.path.dirname(__file__),
                        "notificacion_alertas.py")
    if not os.path.exists(ruta):
        print(f"‼️ Notificación: no se encontró '{ruta}'")
        return None
    try:
        p = subprocess.Popen([sys.executable, ruta], cwd=os.path.dirname(__file__))
        print(f"▶ Notificación de alertas iniciado (PID={p.pid})")
        return p
    except Exception as e:
        print(f"‼️ Error notificación: {e}")
        return None

# ----------------------------------------
# Función para iniciar correo pronóstico
# ----------------------------------------
def iniciar_pronostico():
    ruta = os.path.join(os.path.dirname(__file__), "correo_pronostico.py")
    if not os.path.exists(ruta):
        print(f"‼️ Correo pronóstico: no se encontró '{ruta}'")
        return None
    try:
        p = subprocess.Popen([sys.executable, ruta], cwd=os.path.dirname(__file__))
        print(f"▶ Correo pronóstico iniciado (PID={p.pid})")
        return p
    except Exception as e:
        print(f"‼️ Error pronóstico: {e}")
        return None

# ----------------------------------------
# Función para detener procesos hijos
# ----------------------------------------
def detener_proceso(proc, name):
    if proc and proc.poll() is None:
        print(f"▶ Deteniendo {name}...")
        try:
            proc.terminate()
            proc.wait(5)
            print(f"▶ {name} detenido.")
        except Exception:
            proc.kill()
            print(f"‼️ {name} forzado kill.")

# ----------------------------------------
# Manejador de señales para cierre limpio
# ----------------------------------------
def manejador_senal(sig, frame):
    global generador_proc, notificacion_proc, pronostico_proc
    print("\n▶ Señal recibida, cerrando...")
    detener_proceso(generador_proc, "generador")
    detener_proceso(notificacion_proc, "notificaciones")
    detener_proceso(pronostico_proc, "pronóstico")
    sys.exit(0)

# ----------------------------------------
# Punto de entrada principal
# ----------------------------------------
if __name__ == "__main__":
    signal.signal(signal.SIGINT, manejador_senal)
    signal.signal(signal.SIGTERM, manejador_senal)

    # Lanzar subprocesos
    #generador_proc = iniciar_generador()
    #notificacion_proc = iniciar_notificacion()
    #pronostico_proc = iniciar_pronostico()

    # Logs de estado
    if not generador_proc:
        print("‼️ Generador no arrancó.")
    if not notificacion_proc:
        print("‼️ Notificaciones no arrancaron.")
    if not pronostico_proc:
        print("‼️ Pronóstico no arrancó.")

    # Iniciar Flask
    print("▶ Iniciando Flask...")
    try:
        app.run(host='0.0.0.0', port=5000, debug=True)
    finally:
        detener_proceso(generador_proc, "generador")
        detener_proceso(notificacion_proc, "notificaciones")
        detener_proceso(pronostico_proc, "pronóstico")
