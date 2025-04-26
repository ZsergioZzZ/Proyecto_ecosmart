# EcoSmart<br>
EcoSmart es una aplicación web que nace como respuesta a desafíos como el cambio climático, la escasez de recursos hídricos y reducir el impacto ambiental de las prácticas agrícolas tradicionales, proporcionando una plataforma integral que aprovecha tecnologías de vanguardia para revolucionar la forma en que se gestiona la agricultura, desde pequeñas explotaciones hasta operaciones comerciales a gran escala.
# Características<br>
- Gestión Integral de Cultivos e Insumos
- Sistema de Alertas Prioritarias
  - Notificaciones en Tiempo Real
  - Historial de Alertas
- Vista General de Zonas Agrícolas
- Visualización de Datos
- Asistente IA Integrado (Ollama)
- Pronóstico del Clima
# Dependencias
- Sistemas Operativos compatibles (por ejemplo, cualquier versión de Windows, macOS, o Linux).
- Interpretes o compiladores para cada uno de los lenguajes de programación utilizados:
  - Python
  - Java 
  - JavaScript 
  - HTML
  - Node.js
  - CSS
  - MongoDB Atlas
- Editores de texto o IDEs que soporten estos lenguajes (VSCode, IntelliJ, etc.).
# Instalación
1. [Configurar Git]([docs/CONTRIBUTING.md](https://docs.github.com/es/get-started/git-basics/set-up-git))
2. [Clonar repositorio]([docs/CONTRIBUTING.md](https://docs.github.com/es/repositories/creating-and-managing-repositories/cloning-a-repository))<br>
   `https://github.com/ZsergioZzZ/Proyecto_ecosmart`
3. Instalar Dependencias
   - [Python](https://www.youtube.com/watch?v=yXoiFeK4_Sk)
   - [Node.js](https://www.youtube.com/watch?v=gG7E-n2fjmU)
   - [Java](https://www.youtube.com/watch?v=57ekn6xnrqU)
   - Extenciones para lenguajes.
4. [Conexión a MongoDB Atlas](https://www.youtube.com/watch?v=HsYA3QvWGlk)<br>
   `mongodb+srv://SergioZ:<db_password>@cluster0.xqc6cre.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`
6. Confirmar la instalación y Verificar los archivos.
# Configuración del Entorno
1. Copia el archivo `.env.example` y renómbralo como `.env`.
2. Completa las variables necesarias:
   - MONGO_URI: URI de conexión de MongoDB Atlas
   - OWM_API_KEY: API Key de OpenWeatherMap
   - OPENROUTER_API_KEY: API Key de OpenRouter
3. Instalación recomendada
   - `python -m venv venv`
   - `source venv/bin/activate`  # Linux/macOS
   - `.\venv\Scripts\activate`    # Windows
4. Instala las dependencias:
   - `pip install -r requirements.txt`



