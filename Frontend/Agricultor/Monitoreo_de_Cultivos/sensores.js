//---------------
// Inicializar el mapa
//---------------
const map = L.map('mapaParcela');
L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  { attribution: 'Tiles © Esri' }
).addTo(map);

if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    pos => map.setView([pos.coords.latitude, pos.coords.longitude], 14),
    () => map.setView([-33.4489, -70.6693], 14)
  );
} else {
  map.setView([-33.4489, -70.6693], 14);
}

let poligono = null;

//---------------
// Cargar parcelas en el select
//---------------
async function cargarParcelasSensores() {
  const select = document.getElementById("parcelaAsociada");
  if (!select) return;

  const correo = localStorage.getItem("correoUsuario");
  if (!correo) {
    alert("No hay usuario logueado");
    return;
  }

  try {
    const res = await fetch(
      `http://localhost:5000/api/sensores/parcelas-usuario?correo=${encodeURIComponent(correo)}`
    );
    const parcelas = await res.json();

    select.innerHTML = '<option value="">Seleccione una parcela</option>';
    parcelas.sort((a,b) => {
      const na = `${a.nombre} - Parcela ${a.numero}`.toLowerCase();
      const nb = `${b.nombre} - Parcela ${b.numero}`.toLowerCase();
      return na.localeCompare(nb);
    });

    parcelas.forEach(p => {
      const nombreComp = `${p.nombre} - Parcela ${p.numero}`;
      const opt = document.createElement("option");
      opt.value = nombreComp;
      opt.textContent = nombreComp;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error("Error cargando parcelas:", err);
  }
}

//---------------
// Actualizar indicadores de sensores
//---------------
function actualizarSensoresDatos(datos) {
  document.getElementById("humedadValor").textContent =
    obtenerValor(datos["Humedad del suelo"]) ?? "--";
  document.getElementById("phValor").textContent =
    obtenerValor(datos["Nivel de PH"]) ?? "--";
  document.getElementById("nitrogenoValor").textContent =
    obtenerValor(datos["Nitrógeno"]) ?? "--";
  document.getElementById("fosforoValor").textContent =
    obtenerValor(datos["Fósforo"]) ?? "--";
  document.getElementById("potasioValor").textContent =
    obtenerValor(datos["Potasio"]) ?? "--";
}

//---------------
// Obtener el valor más reciente
//---------------
function obtenerValor(lista) {
  if (Array.isArray(lista) && lista.length > 0) {
    return lista[0].valor?.toFixed?.(1);
  }
  return null;
}

//---------------
// Al seleccionar una parcela
//---------------
document
  .getElementById("parcelaAsociada")
  .addEventListener("change", async function () {
    const sel = this.value;

    // Si NO hay selección, limpiar todo
    if (!sel) {
      if (poligono) {
        map.removeLayer(poligono);
        poligono = null;
      }
      // Limpiar indicadores
      ["humedadValor","phValor","nitrogenoValor","fosforoValor","potasioValor"]
        .forEach(id => document.getElementById(id).textContent = "--");
      document.getElementById("cultivoValor").textContent = "--";
      return;
    }

    const [nombre, numero] = sel.split(" - Parcela ");

    try {
      // 1) Obtener datos de sensores
      const resS = await fetch(
        `http://localhost:5000/api/sensores/datos?nombre=${nombre}&numero=${numero}`
      );
      const datos = await resS.json();
      if (!datos.error) actualizarSensoresDatos(datos);

      // 2) Obtener datos de la parcela (para puntos y cultivo)
      const resP = await fetch(
        `http://localhost:5000/api/sensores/parcela?nombre=${nombre}&numero=${numero}`
      );
      const parcela = await resP.json();

      // Mostrar cultivo
      document.getElementById("cultivoValor").textContent =
        parcela.cultivo ?? "--";

      // Dibujar polígono
      if (!parcela.puntos || parcela.puntos.length < 3) {
        alert("La parcela no tiene suficientes puntos para dibujar.");
        return;
      }
      const coords = parcela.puntos.map(p => [p.lat, p.lng]);
      if (poligono) map.removeLayer(poligono);
      poligono = L.polygon(coords, {
        color: "#FF0000", fillColor: "#FF0000", fillOpacity: 0.1, weight: 2
      }).addTo(map);
      map.setView(poligono.getBounds().getCenter(), 16.5);

    } catch (err) {
      console.error("Error al cargar datos:", err);
    }
  });

// Ejecutar al inicio
document.addEventListener("DOMContentLoaded", cargarParcelasSensores);
