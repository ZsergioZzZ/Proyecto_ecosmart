//---------------
// Inicializar el mapa
//---------------
const map = L.map('mapaParcela');

L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles © Esri'
}).addTo(map);

if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    (position) => {
      map.setView([position.coords.latitude, position.coords.longitude], 14);
    },
    () => {
      map.setView([-33.4489, -70.6693], 14);
    }
  );
} else {
  map.setView([-33.4489, -70.6693], 14);
}

// Variable global para el polígono
let poligono = null;

//---------------
// Cargar parcelas en el select
//---------------
async function cargarParcelasSensores() {
  const select = document.getElementById("parcelaAsociada");
  if (!select) return;

  try {
    const res = await fetch("http://localhost:5000/api/sensores/parcelas");


    const parcelas = await res.json();

    select.innerHTML = '<option value="">Seleccione una parcela</option>';

    parcelas.sort((a, b) => {
      const nombreA = `${a.nombre} - Parcela ${a.numero}`.toLowerCase();
      const nombreB = `${b.nombre} - Parcela ${b.numero}`.toLowerCase();
      return nombreA.localeCompare(nombreB);
    });

    parcelas.forEach(parcela => {
      const nombreCompleto = `${parcela.nombre} - Parcela ${parcela.numero}`;
      const option = document.createElement("option");
      option.value = nombreCompleto;
      option.textContent = nombreCompleto;
      select.appendChild(option);
    });

  } catch (error) {
    console.error("Error cargando parcelas:", error);
  }
}

//---------------
// Actualizar indicadores de sensores
//---------------
function actualizarIndicadores(datos) {
  const temp = obtenerValorMasReciente(datos["Temperatura Ambiente"]);
  const humedad = obtenerValorMasReciente(datos["Humedad del suelo"]);
  const ph = obtenerValorMasReciente(datos["Nivel de PH"]);
  const nutrientes = obtenerValorMasReciente(datos["Nivel de Nutrientes"]);

  document.getElementById("tempValor").textContent = temp ?? "--";
  document.getElementById("humedadValor").textContent = humedad ?? "--";
  document.getElementById("phValor").textContent = ph ?? "--";
  document.getElementById("nutrientesValor").textContent = nutrientes ?? "--";
}

//---------------
// Obtener el valor más reciente
//---------------
function obtenerValorMasReciente(lista) {
  if (Array.isArray(lista) && lista.length > 0) {
    return lista[0].valor?.toFixed?.(1);
  }
  return null;
}

//---------------
// Al seleccionar una parcela
//---------------
document.getElementById("parcelaAsociada").addEventListener("change", async function () {
  const seleccion = this.value;

  // ✅ Si no hay selección, limpiar el polígono y salir
  if (!seleccion) {
    if (poligono) {
      map.removeLayer(poligono);
      poligono = null;
    }

    // También puedes limpiar los indicadores si quieres:
    actualizarIndicadores({
      "Temperatura Ambiente": [],
      "Humedad del suelo": [],
      "Nivel de PH": [],
      "Nivel de Nutrientes": []
    });

    return;
  }

  const partes = seleccion.split(" - Parcela ");
  const nombre = partes[0];
  const numero = partes[1];

  try {
    // Obtener datos de sensores
    const resSensores = await fetch(`http://localhost:5000/api/sensores/datos?nombre=${nombre}&numero=${numero}`);
    const datos = await resSensores.json();
    if (!datos.error) actualizarIndicadores(datos);

    // Obtener datos de parcela (con puntos)
    const resParcela = await fetch(`http://localhost:5000/api/sensores/parcela?nombre=${nombre}&numero=${numero}`);
    const parcela = await resParcela.json();

    if (!parcela.puntos || parcela.puntos.length < 3) {
      alert("La parcela no tiene suficientes puntos para ser dibujada.");
      return;
    }

    const puntos = parcela.puntos.map(p => [p.lat, p.lng]);

    if (poligono) map.removeLayer(poligono);
    poligono = L.polygon(puntos, {
      color: "#FF0000",
      fillColor: "#FF0000",
      fillOpacity: 0.1,
      weight: 2
    }).addTo(map);

    const centro = poligono.getBounds().getCenter();
    map.setView(centro, 16.5);

  } catch (error) {
    console.error("Error al cargar datos:", error);
  }
});


// Ejecutar carga de parcelas al inicio
document.addEventListener("DOMContentLoaded", cargarParcelasSensores);
