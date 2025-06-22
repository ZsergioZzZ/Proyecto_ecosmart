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

  const correo = localStorage.getItem("correoUsuario");
  if (!correo) {
    alert("No hay usuario logueado");
    return;
  }

  try {
    // Llama al nuevo endpoint pasando el correo
    const res = await fetch(`http://localhost:5000/api/parcelas-usuario?correo=${encodeURIComponent(correo)}`);
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

// Ejecutar al cargar la página
document.addEventListener("DOMContentLoaded", cargarParcelas);



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
    .then(async data => {

        // Mostrar datos en el panel izquierdo
        document.getElementById("info-nombre").textContent = data.nombre || "—";
        document.getElementById("info-numero").textContent = data.numero || "—";
        document.getElementById("info-ubicacion").textContent = data.ubicacion || "—";
        document.getElementById("info-cultivo").textContent = data.cultivo || "—";

        
        cargarDatosSensores(nombre, numero);

        // Cargar tipos de sensores reales desde datos_sensores
const selectTipo = document.getElementById("select-tipo");
selectTipo.innerHTML = '<option value="">Seleccione tipo de sensor</option>';

try {
  const res = await fetch(`http://localhost:5000/api/datos_sensores?nombre=${encodeURIComponent(data.nombre)}&numero=${encodeURIComponent(data.numero)}`);
  const datos = await res.json();

  console.log("Tipos disponibles para exactitud:", Object.keys(datos)); // depuración

  Object.keys(datos).forEach(tipo => {
    const option = document.createElement("option");
    option.value = tipo;
    option.textContent = tipo;
    selectTipo.appendChild(option);
  });
} catch (err) {
  console.error("Error al cargar tipos de sensores:", err);
}
        
        


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

//BOTON PARA EXPORTAR CSV
document.getElementById("btnExportarCSV").addEventListener("click", async () => {
  if (Object.keys(datosActuales).length === 0) {
    alert("Primero selecciona una parcela para exportar sus datos.");
    return;
  }

  const nombre = document.getElementById("info-nombre").textContent;
  const numero = document.getElementById("info-numero").textContent;

  const infoParcela = infoActualParcela;
  const sensores = [];

  // Sensores básicos
  const tipos = ["Temperatura Ambiente", "Humedad del suelo", "Nivel de PH"];
  for (const tipo of tipos) {
    const valor = parseFloat(document.getElementById("valor-ideal-ia")?.value);
    if (!isNaN(valor)) {
      sensores.push({ tipo, valor_ideal: valor });
    }
  }

  // Nutrientes individuales
  if (document.getElementById("nutrientes-ideales").style.display === "flex") {
    const n = parseFloat(document.getElementById("valor-n").value);
    const p = parseFloat(document.getElementById("valor-p").value);
    const k = parseFloat(document.getElementById("valor-k").value);
    if (!isNaN(n)) sensores.push({ tipo: "nitrógeno", valor_ideal: n });
    if (!isNaN(p)) sensores.push({ tipo: "fósforo", valor_ideal: p });
    if (!isNaN(k)) sensores.push({ tipo: "potasio", valor_ideal: k });
  }

  // 1. CSV con lecturas
  let csv = `Información de la Parcela\nNombre:,${infoParcela.nombre}\nNúmero:,${infoParcela.numero}\nUbicación:,${infoParcela.ubicacion}\nCultivo:,${infoParcela.cultivo}\n\n`;
  csv += "Tipo,Fecha,Valor,Unidad\n";

  const agregarDatos = (tipo, registros, clave, unidad) => {
    registros.forEach(r => {
      const valor = r[clave];
      const fecha = new Date(r.timestamp).toLocaleString();
      if (valor !== undefined) {
        csv += `${tipo},${fecha},${valor},${unidad}\n`;
      }
    });
  };

  agregarDatos("Temperatura", datosActuales["Temperatura Ambiente"] || [], "temperatura", "°C");
  agregarDatos("Humedad del suelo", datosActuales["Humedad del suelo"] || [], "humedad_suelo", "%");
  agregarDatos("pH", datosActuales["Nivel de PH"] || [], "ph_suelo", "pH");

  (datosActuales["Nivel de Nutrientes"] || []).forEach(r => {
    const fecha = new Date(r.timestamp).toLocaleString();
    const n = r.nutrientes || {};
    if (n["nitrógeno"] !== undefined) csv += `Nitrógeno,${fecha},${n["nitrógeno"]},ppm\n`;
    if (n["fósforo"] !== undefined) csv += `Fósforo,${fecha},${n["fósforo"]},ppm\n`;
    if (n["potasio"] !== undefined) csv += `Potasio,${fecha},${n["potasio"]},ppm\n`;
  });

  // 2. Obtener exactitud del backend
  try {
    const res = await fetch("http://localhost:5000/api/exportar_exactitud_csv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, numero, sensores })
    });

    if (!res.ok) throw new Error("Fallo al obtener exactitud");

    const exactitudTexto = await res.text();

    csv += `\n\nSECCIÓN 2 - Exactitud de sensores (calculado por IA)\n`;
    csv += `Parcela,Sensor,Valor ideal,Exactitud (%),Fecha\n`;

    const lineas = exactitudTexto.trim().split("\n").slice(1); // Saltar encabezado original
    lineas.forEach(line => {
      const partes = line.split(",");
      if (partes.length >= 5) {
      const [parcela, sensor, ideal, exactitud, fecha] = partes;
      const exactitudFmt = parseFloat(exactitud).toFixed(2);
      const idealFmt = parseFloat(ideal).toFixed(2);
      csv += `${parcela},${sensor},${idealFmt},${exactitudFmt},${fecha}\n`;
    }
  });


  } catch (e) {
    console.error("❌ Error al obtener exactitud:", e);
    csv += "\n\nExactitud: Error al obtener los datos.\n";
  }

  // 3. Descargar
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `datos_y_exactitud_parcela_${numero}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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
}, 30000); // 30 segundos 

function mostrarMensajeActualizacion() {
  const mensaje = document.getElementById("mensaje-actualizacion");
  if (!mensaje) return;

  mensaje.style.display = "block";
  setTimeout(() => {
    mensaje.style.display = "none";
  }, 1500); // se oculta después de 1.5 segundos
}

let valoresIdealesPorCultivo = {};

async function cargarCultivos() {
  try {
    const res = await fetch("http://localhost:5000/api/cultivos");
    const cultivos = await res.json();

    console.log("Cultivos cargados:", cultivos);


    cultivos.forEach(c => {
      valoresIdealesPorCultivo[c.nombre.toLowerCase()] = c.valores_ideales;
    });
  } catch (err) {
    console.error("Error al cargar cultivos:", err);
  }
}

document.addEventListener("DOMContentLoaded", cargarCultivos);


//------ Calcular porcentaje de exactitud ------//
document.addEventListener("DOMContentLoaded", () => {

  document.getElementById("select-tipo").addEventListener("change", async function () {
    const tipoSeleccionado = this.value;
    const valoresSensor = datosActuales[tipoSeleccionado];

    const campoGeneral = document.getElementById("valor-ideal-ia");
    const boxNutrientes = document.getElementById("nutrientes-ideales");

    // Mostrar campo correspondiente
    if (tipoSeleccionado === "Nivel de Nutrientes") {
      campoGeneral.style.display = "none";
      boxNutrientes.style.display = "flex";
    } else {
      campoGeneral.style.display = "block";
      boxNutrientes.style.display = "none";
    }

    // Nombre y número de parcela
    const nombre = document.getElementById("info-nombre").textContent;
    const numero = document.getElementById("info-numero").textContent;
    const nombreCompletoParcela = `${nombre} - Parcela ${numero}`;

    //  Llamada al backend para IA
    try {
      const res = await fetch("http://localhost:5000/valor-ideal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parcela: nombreCompletoParcela, sensor: tipoSeleccionado })
      });

      const data = await res.json();
      console.log("📦 Respuesta IA:", data);

      if (tipoSeleccionado === "Nivel de Nutrientes") {
        const [n, p, k] = data.valor_ideal_npk || [];
        document.getElementById("valor-n").value = isNaN(data.n) ? "" : data.n;
        document.getElementById("valor-p").value = isNaN(data.p) ? "" : data.p;
        document.getElementById("valor-k").value = isNaN(data.k) ? "" : data.k;
      } else {
        campoGeneral.value = data.valor_ideal ?? "⚠️ Sin valor";
      }

    } catch (e) {
      console.error("❌ Error al obtener valor ideal IA:", e);
    }

    // Cargar valores históricos únicos (no necesario para nutrientes)
    if (Array.isArray(valoresSensor)) {
      const valoresUnicos = new Set();

      valoresSensor.forEach(entry => {
        let valor;
        if (tipoSeleccionado === "Temperatura Ambiente") valor = entry.temperatura;
        else if (tipoSeleccionado === "Humedad del suelo") valor = entry.humedad_suelo;
        else if (tipoSeleccionado === "Nivel de PH") valor = entry.ph_suelo;
        else if (tipoSeleccionado === "Nivel de Nutrientes") {
          const n = entry.nutrientes?.["nitrógeno"];
          const p = entry.nutrientes?.["fósforo"];
          const k = entry.nutrientes?.["potasio"];
          valor = Math.round((n + p + k) / 3);
        }

        if (valor !== undefined && !valoresUnicos.has(valor)) {
          valoresUnicos.add(valor);
        }
      });
    }
  });

  //  Botón calcular exactitud
  document.getElementById("btn-calcular-exactitud").addEventListener("click", async () => {
    const tipo = document.getElementById("select-tipo").value;
    const nombre = document.getElementById("info-nombre").textContent;
    const numero = document.getElementById("info-numero").textContent;
    const contenedor = document.getElementById("lista-exactitud");
    contenedor.innerHTML = "";

    if (tipo === "Nivel de Nutrientes") {
      // Calcular exactitud por N, P y K
      const nutrientes = [
        { clave: "nitrógeno", valor: parseFloat(document.getElementById("valor-n").value) },
        { clave: "fósforo", valor: parseFloat(document.getElementById("valor-p").value) },
        { clave: "potasio", valor: parseFloat(document.getElementById("valor-k").value) }
      ];

     for (const nut of nutrientes) {
      if (isNaN(nut.valor)) continue;

      const res = await fetch(`http://localhost:5000/api/exactitud_sensor?nombre=${encodeURIComponent(nombre)}&numero=${numero}&tipo=${encodeURIComponent(nut.clave)}&valor_ideal=${nut.valor}`);

        const data = await res.json();

        if (!data.error) {
          const li = document.createElement("li");
          li.textContent = `Exactitud de ${nut.clave} (${nut.valor}): ${data.exactitud}%`;
          contenedor.appendChild(li);
        } else {
          contenedor.innerHTML += `<li>Error al obtener exactitud de ${nut.clave}</li>`;
        }
      }

    } else {
      const valorIdeal = parseFloat(document.getElementById("valor-ideal-ia").value);
      if (!tipo || isNaN(valorIdeal)) {
        alert("Debes seleccionar un tipo de sensor y definir el valor ideal.");
        return;
      }

      const res = await fetch(`http://localhost:5000/api/exactitud_sensor?nombre=${encodeURIComponent(nombre)}&numero=${numero}&tipo=${encodeURIComponent(tipo)}&valor_ideal=${valorIdeal}`);
      const data = await res.json();

      if (!data.error) {
        const li = document.createElement("li");
        li.textContent = `La exactitud de ${tipo.toLowerCase()} (${valorIdeal}) ha estado presente en un ${data.exactitud}% de los datos.`;
        contenedor.appendChild(li);
      } else {
        contenedor.innerHTML = "<li>Error al obtener datos</li>";
      }
    }
  });
});

// ————————————————
// Función para limpiar la vista antes de cargar nueva parcela
// ————————————————
function clearParcelaInfo() {
  // Limpiar datos de texto
  document.getElementById("info-nombre").textContent   = "—";
  document.getElementById("info-numero").textContent   = "—";
  document.getElementById("info-ubicacion").textContent= "—";
  document.getElementById("info-cultivo").textContent  = "—";

  // Limpiar select de tipos
  const selectTipo = document.getElementById("select-tipo");
  selectTipo.innerHTML = '<option value="">Seleccione tipo de sensor</option>';

  // Ocultar inputs de nutrientes y campo general
  document.getElementById("valor-ideal-ia").value = "";
  document.getElementById("valor-ideal-ia").style.display      = "block";
  const boxNutrientes = document.getElementById("nutrientes-ideales");
  boxNutrientes.style.display = "none";
  document.getElementById("valor-n").value = "";
  document.getElementById("valor-p").value = "";
  document.getElementById("valor-k").value = "";

  // Limpiar lista de exactitud
  document.getElementById("lista-exactitud").innerHTML = "";

  // Limpiar gráficos
  [graficoTemperatura, graficoHumedad, graficoPh, graficoNutrientes].forEach(g => {
    g.data.labels = [];
    g.data.datasets.forEach(ds => ds.data = []);
    g.update();
  });

  // Eliminar polígono anterior si existe
  if (poligono) {
    map.removeLayer(poligono);
    poligono = null;
  }

  // Limpiar datos guardados
  infoActualParcela = {};
  datosActuales      = {};
}

// ————————————————
// Listener de cambio de parcela
// ————————————————
document.getElementById("parcelaAsociada").addEventListener("change", function () {
  // 1) Limpiar todo
  clearParcelaInfo();

  // 2) Si no es una opción válida, salimos
  const valor = this.value;
  if (!valor.includes(" - Parcela ")) return;

  // 3) El resto de tu lógica para fetch…
  const [nombre, numeroTexto] = valor.split(" - Parcela ");
  const numero = numeroTexto.trim();

  // …
});
