//---------------
// Inicializar mapa
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

//---------------
// Cargar parcelas en el select
//---------------
async function cargarParcelas() {
  const select = document.getElementById("parcelaAsociada");
  if (!select) return;

  try {
    const res = await fetch("http://localhost:5000/parcelas");
    const parcelas = await res.json();

    select.innerHTML = '<option value="">Seleccione una parcela</option>';

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
// Dibujar parcela seleccionada
//---------------
let poligono = null;

document.getElementById("parcelaAsociada").addEventListener("change", function () {
  const valor = this.value;
  if (!valor.includes(" - Parcela ")) return;

  const [nombre, numeroTexto] = valor.split(" - Parcela ");
  const numero = numeroTexto.trim();

  fetch(`http://localhost:5000/api/parcela-analisis?nombre=${encodeURIComponent(nombre)}&numero=${encodeURIComponent(numero)}`)
    .then(res => res.json())
    .then(data => {
        // Mostrar datos en el panel izquierdo
        document.getElementById("info-nombre").textContent = data.nombre || "—";
        document.getElementById("info-numero").textContent = data.numero || "—";
        document.getElementById("info-ubicacion").textContent = data.ubicacion || "—";
        document.getElementById("info-cultivo").textContent = data.cultivo || "—";

        cargarDatosSensores(nombre, numero);


      if (!data.puntos || data.puntos.length < 3) {
        alert("La parcela no tiene suficientes puntos para ser dibujada.");
        return;
      }

      const puntos = data.puntos.map(p => [p.lat, p.lng]); 

      if (poligono) map.removeLayer(poligono);
      poligono = L.polygon(puntos, {
      color: "#FF0000",       // borde rojo
      weight: 3,              // grosor del borde
      opacity: 1,             // opacidad del borde
      fillColor: "#FF0000",   // color de relleno rojo también
      fillOpacity: 0.1        // opacidad del relleno
      }).addTo(map);

      const centro = poligono.getBounds().getCenter();
      map.setView(centro, 16.3);

    })
    .catch(err => {
      console.error("Error al obtener la parcela:", err);
    });
});

let infoActualParcela = {};
let datosActuales = {};


// Ejecutar al cargar la página
document.addEventListener("DOMContentLoaded", cargarParcelas);

async function cargarDatosSensores(nombre, numero) {
  try {
    const res = await fetch(`http://localhost:5000/api/datos_sensores?nombre=${encodeURIComponent(nombre)}&numero=${encodeURIComponent(numero)}`);
    const data = await res.json();

    datosActuales = data;
    infoActualParcela = {
      nombre: document.getElementById("info-nombre").textContent,
      numero: document.getElementById("info-numero").textContent,
      ubicacion: document.getElementById("info-ubicacion").textContent,
      cultivo: document.getElementById("info-cultivo").textContent
    };

    console.log("Temperatura:", data["Temperatura Ambiente"]);
    console.log("Humedad:", data["Humedad del suelo"]);
    console.log("pH:", data["Nivel de PH"]);
    console.log("Nutrientes:", data["Nivel de Nutrientes"]);


    console.log(" Datos sensores:", data);

    // Temperatura Ambiente
    if (Array.isArray(data["Temperatura Ambiente"])) {
    const temperaturas = data["Temperatura Ambiente"].map(d => d.temperatura).reverse();
    const labels = data["Temperatura Ambiente"].map(d => new Date(d.timestamp).toLocaleTimeString()).reverse();

    graficoTemperatura.data.labels = labels;
    graficoTemperatura.data.datasets[0].data = temperaturas;


    document.getElementById("ultimo-temp").textContent = `${temperaturas[temperaturas.length - 1]} °C`;


    } else {
    graficoTemperatura.data.labels = [];
    graficoTemperatura.data.datasets[0].data = [];
    }

    // Humedad del Suelo
    if (Array.isArray(data["Humedad del suelo"])) {
    const humedad = data["Humedad del suelo"].map(d => d.humedad_suelo).reverse();
    const labels = data["Humedad del suelo"].map(d => new Date(d.timestamp).toLocaleTimeString()).reverse();

    graficoHumedad.data.labels = labels;
    graficoHumedad.data.datasets[0].data = humedad;

    document.getElementById("ultimo-humedad").textContent = `${humedad[humedad.length - 1]} %`;

    } else {
    graficoHumedad.data.labels = [];
    graficoHumedad.data.datasets[0].data = [];
    }

    // pH del Suelo
    if (Array.isArray(data["Nivel de PH"])) {
    const ph = data["Nivel de PH"].map(d => d.ph_suelo).reverse();
    const labels = data["Nivel de PH"].map(d => new Date(d.timestamp).toLocaleTimeString()).reverse();

    graficoPh.data.labels = labels;
    graficoPh.data.datasets[0].data = ph;

    document.getElementById("ultimo-ph").textContent = `${ph[ph.length - 1]}`;

    } else {
    graficoPh.data.labels = [];
    graficoPh.data.datasets[0].data = [];
    }

    // Nutrientes
    if (Array.isArray(data["Nivel de Nutrientes"])) {
    const labels = data["Nivel de Nutrientes"].map(d => new Date(d.timestamp).toLocaleTimeString()).reverse();
    const nitr = data["Nivel de Nutrientes"].map(d => d.nutrientes?.["nitrógeno"] ?? 0).reverse();
    const fosf = data["Nivel de Nutrientes"].map(d => d.nutrientes?.["fósforo"] ?? 0).reverse();
    const pota = data["Nivel de Nutrientes"].map(d => d.nutrientes?.["potasio"] ?? 0).reverse();

    graficoNutrientes.data.labels = labels;
    graficoNutrientes.data.datasets[0].data = nitr;
    graficoNutrientes.data.datasets[1].data = fosf;
    graficoNutrientes.data.datasets[2].data = pota;
    document.getElementById("ultimo-n").textContent = `${nitr[nitr.length - 1]} ppm`;
    document.getElementById("ultimo-p").textContent = `${fosf[fosf.length - 1]} ppm`;
    document.getElementById("ultimo-k").textContent = `${pota[pota.length - 1]} ppm`;
    } else {
    graficoNutrientes.data.labels = [];
    graficoNutrientes.data.datasets.forEach(ds => ds.data = []);
    }

    graficoTemperatura.update();
    graficoHumedad.update();
    graficoPh.update();
    graficoNutrientes.update();

  } catch (error) {
    console.error("Error al cargar datos de sensores:", error);
  }
}



//---------------
// Gráficos vacíos al inicio
//---------------
const graficoTemperatura = new Chart(document.getElementById('graficoTemperatura'), {
  type: 'line',
  data: { labels: [], datasets: [{ label: 'Temperatura (°C)', data: [], borderColor: '#000000', borderWidth: 2, fill: false, tension: 0.3 }] },
  options: { responsive: true, scales: { y: { beginAtZero: false } } }
});

const graficoHumedad = new Chart(document.getElementById('graficoHumedad'), {
  type: 'line',
  data: { labels: [], datasets: [{ label: 'Humedad (%)', data: [], borderColor: '#000000', borderWidth: 2, fill: false, tension: 0.3 }] },
  options: { responsive: true, scales: { y: { beginAtZero: true } } }
});

const graficoPh = new Chart(document.getElementById('graficoPh'), {
  type: 'line',
  data: { labels: [], datasets: [{ label: 'pH', data: [], borderColor: '#000000', borderWidth: 2, fill: false, tension: 0.3 }] },
  options: { responsive: true, scales: { y: { min: 5.5, max: 7.5 } } }
});

const graficoNutrientes = new Chart(document.getElementById('graficoNutrientes'), {
  type: 'line',
  data: {
    labels: [],
    datasets: [
      { label: 'Nitrógeno (N)', data: [], borderColor: '#000000', borderWidth: 2, fill: false, tension: 0.3 },
      { label: 'Fósforo (P)', data: [], borderColor: '#3A5A40', borderWidth: 2, fill: false, tension: 0.3 },
      { label: 'Potasio (K)', data: [], borderColor: '#6A994E', borderWidth: 2, fill: false, tension: 0.3 }
    ]
  },
  options: { responsive: true, scales: { y: { beginAtZero: true } } }
});


function exportarDatosCSV(infoParcela, dataSensores) {
  let csv = "Tipo,Fecha,Valor,Unidad\n";

  const agregarDatos = (tipo, registros, clave, unidad) => {
    registros.forEach(r => {
      const valor = r[clave];
      const fecha = new Date(r.timestamp).toLocaleString();
      if (valor !== undefined) {
        csv += `${tipo},${fecha},${valor},${unidad}\n`;
      }
    });
  };

  agregarDatos("Temperatura", dataSensores["Temperatura Ambiente"] || [], "temperatura", "°C");
  agregarDatos("Humedad del suelo", dataSensores["Humedad del suelo"] || [], "humedad_suelo", "%");
  agregarDatos("pH", dataSensores["Nivel de PH"] || [], "ph_suelo", "pH");

  // Nutrientes separados
  (dataSensores["Nivel de Nutrientes"] || []).forEach(r => {
    const fecha = new Date(r.timestamp).toLocaleString();
    const n = r.nutrientes || {};
    if (n["nitrógeno"] !== undefined) csv += `Nitrógeno,${fecha},${n["nitrógeno"]},ppm\n`;
    if (n["fósforo"] !== undefined) csv += `Fósforo,${fecha},${n["fósforo"]},ppm\n`;
    if (n["potasio"] !== undefined) csv += `Potasio,${fecha},${n["potasio"]},ppm\n`;
  });

  // Info parcela
  csv = `Información de la Parcela\nNombre:,${infoParcela.nombre}\nNúmero:,${infoParcela.numero}\nUbicación:,${infoParcela.ubicacion}\nCultivo:,${infoParcela.cultivo}\n\n${csv}`;

  const BOM = "\uFEFF"; 
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `datos_parcela_${infoParcela.numero}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}


document.getElementById("btnExportarCSV").addEventListener("click", () => {
  if (Object.keys(datosActuales).length > 0) {
    exportarDatosCSV(infoActualParcela, datosActuales);
  } else {
    alert("Primero selecciona una parcela para exportar sus datos.");
  }
});


//---------------
// Actualización automática cada 60 segundos
//---------------
setInterval(() => {
  if (infoActualParcela.nombre && infoActualParcela.numero) {
    console.log("Actualizando datos de sensores automáticamente...");
    cargarDatosSensores(infoActualParcela.nombre, infoActualParcela.numero);
    mostrarMensajeActualizacion();
  }
}, 60000); // 60 segundos = 1 minuto

function mostrarMensajeActualizacion() {
  const mensaje = document.getElementById("mensaje-actualizacion");
  if (!mensaje) return;

  mensaje.style.display = "block";
  setTimeout(() => {
    mensaje.style.display = "none";
  }, 1500); // se oculta después de 1.5 segundos
}

