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
# (cualquier otra variable que necesite tu aplicación)

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
from Backend.Tecnico.Configuracion_sistema.Usuarios.usuarios import cambiar_usuario_tecnico_blueprint
from Backend.Agricultor.Monitoreo_de_Cultivos.Visualizacion_datos.visualizacion_graficos import visualizacion_g_blueprint
from Backend.Agronomo.Asistente_IA.recomendacion import sensores_bp
from Backend.Tecnico.Configuracion_de_alertas.configurar_alerta import configurar_umbrales_alerta_blueprint
from Backend.Tecnico.Configuracion_de_alertas.notificaciones_app import notificaciones_blueprint
from Backend.Agronomo.Prediccion_y_alertas.prediccion import prediccion_blueprint
#from Backend.Agricultor.Monitoreo_de_Cultivos.Visualizacion_datos.visualizacion_graficos import visualizacion_web
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
app.register_blueprint(visualizacion_g_blueprint)
app.register_blueprint(sensores_bp)
app.register_blueprint(configurar_umbrales_alerta_blueprint)
app.register_blueprint(notificaciones_blueprint)
app.register_blueprint(prediccion_blueprint)
#app.register_blueprint(visualizacion_web)
app.register_blueprint(analisis_riego_blueprint)

# ----------------------------------------
# Funciones para manejar el subproceso
# ----------------------------------------
generador_proc = None
notificacion_proc  = None

def iniciar_generador():

    ruta_generador = os.path.join(os.path.dirname(__file__), "datos_sensores.py")
    python_interprete = sys.executable  # Usa el mismo intérprete de Python

    try:
        proceso = subprocess.Popen(
            [python_interprete, ruta_generador]
            # Si prefieres ver logs en la misma terminal, no especifiques stdout/stderr
            # stdout=subprocess.PIPE,
            # stderr=subprocess.PIPE
        )
        print(f"▶ Proceso generador de datos iniciado (PID = {proceso.pid})")
        return proceso
    except Exception as e:
        print(f"‼️ Error al iniciar generador de datos: {e}")
        return None

def iniciar_notificacion():
    ruta_notificacion = os.path.join(
        os.path.dirname(__file__),
        "Backend",
        "Tecnico",
        "Configuracion_de_alertas",
        "notificacion_alertas.py"
    )

    # Verifica que el archivo exista en esa ubicación
    if not os.path.exists(ruta_notificacion):
        print(f"‼️ Ruta inválida: no se encontró '{ruta_notificacion}'")
        return None

    # Usa el mismo intérprete de Python que ejecuta este script
    python_interprete = sys.executable

    try:
        proceso = subprocess.Popen(
            [python_interprete, ruta_notificacion],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        print(f"▶ Proceso notificación de alertas iniciado (PID = {proceso.pid})")
        return proceso
    except Exception as e:
        print(f"‼️ Error al iniciar notificación de alertas: {e}")
        return None

def detener_proceso(proceso, nombre):
    """
    Si el proceso hijo está activo, envía terminate() y espera a que cierre.
    En caso de no responder, fuerza kill().
    """
    if proceso and proceso.poll() is None:
        print(f"▶ Deteniendo proceso {nombre}…")
        try:
            proceso.terminate()
            proceso.wait(timeout=10)
            print(f"▶ Proceso {nombre} detenido.")
        except subprocess.TimeoutExpired:
            print(f"‼️ El proceso {nombre} no respondió a terminate(), forzando kill…")
            proceso.kill()
        except Exception as e:
            print(f"‼️ Error al detener el proceso {nombre}: {e}")

def manejador_senal(signum, frame):
    """
    Captura SIGINT (Ctrl+C) o SIGTERM. Detiene ambos subprocesos
    (generador_proc y notificacion_proc) y sale del programa.
    """
    global generador_proc, notificacion_proc
    print("\n▶ Señal recibida, cerrando EcoSmart…")

    if generador_proc:
        detener_proceso(generador_proc, "generador de datos")
    if notificacion_proc:
        detener_proceso(notificacion_proc, "notificación de alertas")

    sys.exit(0)

# ----------------------------------------
# Punto de entrada principal
# ----------------------------------------
if __name__ == "__main__":
    # Registramos el mismo manejador de señal para SIGINT y SIGTERM
    signal.signal(signal.SIGINT, manejador_senal)
    signal.signal(signal.SIGTERM, manejador_senal)

    # Iniciamos el proceso generador de datos
    #generador_proc = iniciar_generador()
    if generador_proc is None:
        print("‼️ No se inició el generador de datos. Verifica la ruta.")
    else:
        print("✅ Generador de datos corriendo en background.")

    # Iniciamos el proceso de notificación de alertas
    #notificacion_proc = iniciar_notificacion()
    if notificacion_proc is None:
        print("‼️ No se inició la notificación de alertas. Verifica la ruta.")
    else:
        print("✅ Notificación de alertas corriendo en background.")

    # Arrancamos la aplicación Flask
    print("▶ Iniciando la aplicación principal (Flask)…")
    try:
        app.run(host='0.0.0.0', port=5000, debug=True)
    finally:
        # Cuando Flask termine, nos aseguramos de detener ambos procesos
        if generador_proc:
            detener_proceso(generador_proc, "generador de datos")
        if notificacion_proc:
            detener_proceso(notificacion_proc, "notificación de alertas")

