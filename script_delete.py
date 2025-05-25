import os
import shutil

def eliminar_cache(directorio):
    for root, dirs, files in os.walk(directorio):
        for nombre in dirs:
            if nombre == "__pycache__":
                ruta = os.path.join(root, nombre)
                print(f"Eliminando: {ruta}")
                shutil.rmtree(ruta)

        for nombre_archivo in files:
            if nombre_archivo.endswith(".pyc"):
                ruta_archivo = os.path.join(root, nombre_archivo)
                print(f"Eliminando archivo .pyc: {ruta_archivo}")
                os.remove(ruta_archivo)

if __name__ == "__main__":
    print("🧹 Limpiando caché de Python...")
    eliminar_cache(".")
    print("✅ Caché eliminada con éxito.")
