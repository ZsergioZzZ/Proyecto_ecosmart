const mapSensorMod = L.map("mapModificarParcelaSensor").setView([-33.4489, -70.6693], 14);

L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
  attribution: "Tiles © Esri",
  maxZoom: 19
}).addTo(mapSensorMod);

// Intentar geolocalización del usuario
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      mapSensorMod.setView([lat, lng], 14); 
    },
    () => {
      mapSensorMod.setView([-33.4489, -70.6693], 14);
    }
  );
} else {
  mapSensorMod.setView([-33.4489, -70.6693], 14);
}


document.addEventListener("DOMContentLoaded", () => {
  const tipoSelect = document.getElementById("tipo-modificacion");
  const divParcela = document.getElementById("modificar-parcela");
  const divSensor = document.getElementById("modificar-sensor");

  tipoSelect.addEventListener("change", function () {
    const tipo = this.value;

    divParcela.style.display = tipo === "parcela" ? "block" : "none";
    divSensor.style.display = tipo === "sensor" ? "block" : "none";

    if (tipo === "sensor") {
      setTimeout(() => {
        mapSensorMod.invalidateSize();
      }, 100);
    }
  });
});


document.addEventListener("DOMContentLoaded", () => {
  cargarParcelasSensor();
});

async function cargarParcelasSensor() {
  try {
    const res = await fetch("http://localhost:5000/api/parcelas");
    if (!res.ok) throw new Error("Error en la respuesta del servidor");
    const parcelas = await res.json();

    const selectParcela = document.getElementById("parcela-sensor");
    selectParcela.innerHTML = "";

    const opcionInicial = document.createElement("option");
    opcionInicial.value = "";
    opcionInicial.textContent = "Seleccione una parcela";
    opcionInicial.disabled = true;
    opcionInicial.selected = true;
    selectParcela.appendChild(opcionInicial);

    parcelas.forEach(p => {
      const option = document.createElement("option");
      option.value = `${p.nombre} - Parcela ${p.numero}`;
      option.textContent = option.value;
      selectParcela.appendChild(option);
    });
  } catch (err) {
    console.error("Error al cargar parcelas para sensores:", err);
  }
}


function guardarCambiosSensor() {
  const seleccion = document.getElementById("parcela-sensor").value;
  const tipo = document.getElementById("tipo-sensor-modificar").value;
  const lat = parseFloat(document.getElementById("latModSensorManual").value);
  const lng = parseFloat(document.getElementById("lngModSensorManual").value);

  if (isNaN(lat) || isNaN(lng)) {
    alert("Las coordenadas no son válidas.");
    return;
  }

  const datos = {
    parcela: seleccion,
    tipo,
    ubicacion: { lat, lng }
  };


  fetch("http://localhost:5000/sensores", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos)
  })
    .then(res => res.json())
    .then(data => {
      if (data.error) throw new Error(data.error);
      alert(data.mensaje);
      limpiarSensorMapa();
      limpiarFormularioSensor();
      restaurarSelectorTipoSensor();
      eliminarPoligonoParcelaSensor();
    })
    .catch(err => {
      console.error(err);
      alert("Error al modificar el sensor.");
    });
}

function eliminarSensor() {
  const seleccion = document.getElementById("parcela-sensor").value;
  const tipo = document.getElementById("tipo-sensor-modificar").value;

  if (!seleccion || !tipo) {
    alert("Debe seleccionar una parcela y tipo de sensor.");
    return;
  }

  if (!confirm(`¿Eliminar sensor de tipo "${tipo}" para "${seleccion}"?`)) return;

  const url = `http://localhost:5000/sensores?parcela=${encodeURIComponent(seleccion)}&tipo=${encodeURIComponent(tipo)}`;

  fetch(url, { method: "DELETE" })
    .then(res => res.json())
    .then(data => {
      if (data.error) throw new Error(data.error);
      alert(data.mensaje);
      limpiarSensorMapa(); 
      limpiarFormularioSensor();
      restaurarSelectorTipoSensor();
      eliminarPoligonoParcelaSensor();
    })
    .catch(err => {
      console.error(err);
      alert("Error al eliminar el sensor.");
    });
}



let polygonSensorParcela = null; 

function dibujarPoligonoParcelaSensor(puntos) {
  if (polygonSensorParcela) {
    mapSensorMod.removeLayer(polygonSensorParcela);
  }
  if (puntos.length >= 3) {
    const latlngs = puntos.map(p => [p.lat, p.lng]);
    polygonSensorParcela = L.polygon(latlngs, {
      color: 'red',            
      weight: 2,
      fill: true,              
      fillColor: 'red',        
      fillOpacity: 0.15       
    }).addTo(mapSensorMod);

    const bounds = L.latLngBounds(latlngs);
    mapSensorMod.fitBounds(bounds, { padding: [20, 20] });
  }
}


document.getElementById("parcela-sensor").addEventListener("change", async function () {
  const seleccion = this.value;
  if (!seleccion.includes(" - Parcela ")) return;

    if (marcadorSensor) {
      mapSensorMod.removeLayer(marcadorSensor);
      marcadorSensor = null;
    }

    const selectTipo = document.getElementById("tipo-sensor-modificar");
    selectTipo.innerHTML = `
      <option value="" disabled selected>Seleccione un tipo de sensor</option>
      <option value="Temperatura Ambiente">Temperatura Ambiente</option>
      <option value="Humedad del suelo">Humedad del suelo</option>
      <option value="Nivel de PH">Nivel de PH</option>
      <option value="Nivel de Nutrientes">Nivel de Nutrientes</option>
    `;
  const [nombre, numTexto] = seleccion.split(" - Parcela ");
  const numero = parseInt(numTexto);

  try {
    const res = await fetch(`http://localhost:5000/api/parcela?nombre=${encodeURIComponent(nombre)}&numero=${numero}`);
    const data = await res.json();

    if (data.puntos && data.puntos.length >= 3) {
      dibujarPoligonoParcelaSensor(data.puntos);
    } else {
      alert("La parcela seleccionada no tiene suficientes puntos.");
    }
  } catch (err) {
    console.error("Error al obtener los puntos de la parcela:", err);
  }
});


let marcadorSensor = null;

function mostrarUbicacionSensor(punto) {
  if (marcadorSensor) {
    mapSensorMod.removeLayer(marcadorSensor);
  }

  marcadorSensor = L.marker([punto.lat, punto.lng], {
    draggable: true
  }).addTo(mapSensorMod);

  marcadorSensor.on("dragend", (e) => {
    const pos = e.target.getLatLng();
    document.getElementById("latModSensorManual").value = pos.lat.toFixed(6);
    document.getElementById("lngModSensorManual").value = pos.lng.toFixed(6);
  });

  mapSensorMod.setView([punto.lat, punto.lng], 17);
}

document.getElementById("tipo-sensor-modificar").addEventListener("change", async function () {
  const parcela = document.getElementById("parcela-sensor").value;
  const tipo = this.value;

  if (!parcela || !tipo) return;

  try {
    const res = await fetch(`http://localhost:5000/sensores?parcela=${encodeURIComponent(parcela)}&tipo=${encodeURIComponent(tipo)}`);
    const data = await res.json();

    if (data.ubicacion) {
      mostrarUbicacionSensor(data.ubicacion); 
    } else {
      alert(`Esta parcela no tiene un sensor de "${tipo}" registrado.`);
    }
  } catch (err) {
    console.error("Error al cargar la ubicación del sensor:", err);
  }
});


function modificarrPuntoSensorManual() {
  const latRaw = document.getElementById("latModSensorManual").value;
  const lngRaw = document.getElementById("lngModSensorManual").value;

  if (!latRaw || !lngRaw) {
    alert("Por favor ingresa latitud y longitud.");
    return;
  }

  const lat = parseFloat(latRaw.replace(",", "."));
  const lng = parseFloat(lngRaw.replace(",", "."));

  if (isNaN(lat) || isNaN(lng)) {
    alert("Por favor ingresa coordenadas válidas.");
    return;
  }

  const latlng = L.latLng(lat, lng);

  if (marcadorSensor) {
    mapSensorMod.removeLayer(marcadorSensor);
  }

  marcadorSensor = L.marker(latlng, { draggable: true }).addTo(mapSensorMod);
  mapSensorMod.setView(latlng, 17);

  marcadorSensor.on("dragend", function (e) {
    const pos = e.target.getLatLng();
    document.getElementById("latModSensorManual").value = pos.lat.toFixed(6);
    document.getElementById("lngModSensorManual").value = pos.lng.toFixed(6);
  });
}

L.Control.ControlesSensor = L.Control.extend({
  onAdd: function () {
    const div = L.DomUtil.create("div", "leaflet-bar leaflet-control leaflet-control-custom");
    div.style.backgroundColor = "white";
    div.style.padding = "10px";
    div.style.borderRadius = "6px";
    div.style.boxShadow = "0 0 6px rgba(0,0,0,0.3)";
    div.style.fontSize = "12px";
    div.style.minWidth = "130px";

    div.innerHTML = `
      <button id="btn-agregar-sensor" onclick="activarAgregarSensor()" style="margin: 2px; display: flex; align-items: center; gap: 6px;">
        <span style="color: blue;">➕</span> Agregar punto
      </button><br/>
      <button id="btn-modificar-sensor" onclick="activarModificarSensor()" style="margin: 2px; display: flex; align-items: center; gap: 6px;">
        <span style="color: orange;">✏️</span> Modificar punto
      </button><br/>
      <button onclick="limpiarSensorMapa()" style="margin: 2px; display: flex; align-items: center; gap: 6px;">
        <span style="color: gray;">🗑️</span> Limpiar mapa
      </button>
    `;

    L.DomEvent.disableClickPropagation(div);
    return div;
  },
  onRemove: function () {}
});

L.control.controlesSensor = function (opts) {
  return new L.Control.ControlesSensor(opts);
};

L.control.controlesSensor({ position: "topright" }).addTo(mapSensorMod);


function activarAgregarSensor() {
  modoSensor = "agregar";
  resaltarBotonSensor("btn-agregar-sensor");
}

function activarModificarSensor() {
  modoSensor = "modificar";
  if (marcadorSensor) {
    marcadorSensor.dragging.enable();
  }
  resaltarBotonSensor("btn-modificar-sensor");
}

function limpiarSensorMapa() {
  if (marcadorSensor) {
    mapSensorMod.removeLayer(marcadorSensor);
    marcadorSensor = null;
  }
  document.getElementById("latModSensorManual").value = "";
  document.getElementById("lngModSensorManual").value = "";
  modoSensor = null;
  resaltarBotonSensor(); 
}

function eliminarPoligonoParcelaSensor() {
  if (polygonSensorParcela) {
    mapSensorMod.removeLayer(polygonSensorParcela);
    polygonSensorParcela = null;
  }
}


function resaltarBotonSensor(id = "") {
  document.querySelectorAll(".leaflet-control-custom button").forEach(btn => {
    btn.style.backgroundColor = "white";
    btn.style.fontWeight = "normal";
  });

  if (id) {
    const boton = document.getElementById(id);
    if (boton) {
      boton.style.backgroundColor = "#e6e6e6";
      boton.style.fontWeight = "bold";
    }
  }
}

mapSensorMod.on("click", function (e) {
  if (modoSensor === "agregar") {
    const latlng = e.latlng;

    if (marcadorSensor) {
      mapSensorMod.removeLayer(marcadorSensor);
    }

    marcadorSensor = L.marker(latlng, { draggable: true }).addTo(mapSensorMod);
    mapSensorMod.panTo(latlng);

    marcadorSensor.on("dragend", (e) => {
      const pos = e.target.getLatLng();
      document.getElementById("latModSensorManual").value = pos.lat.toFixed(6);
      document.getElementById("lngModSensorManual").value = pos.lng.toFixed(6);
    });
  }
});

function limpiarSensorMapa() {
  if (marcadorSensor) {
    mapSensorMod.removeLayer(marcadorSensor);
    marcadorSensor = null;
  }

  document.getElementById("latModSensorManual").value = "";
  document.getElementById("lngModSensorManual").value = "";

  modoSensor = null;
  resaltarBotonSensor(); 
}

function restaurarSelectorTipoSensor() {
  const selectTipo = document.getElementById("tipo-sensor-modificar");
  selectTipo.innerHTML = `
    <option value="" disabled selected>Seleccione un tipo de sensor</option>
    <option value="Temperatura Ambiente">Temperatura Ambiente</option>
    <option value="Humedad del suelo">Humedad del suelo</option>
    <option value="Nivel de PH">Nivel de PH</option>
    <option value="Nivel de Nutrientes">Nivel de Nutrientes</option>
  `;
}


function limpiarFormularioSensor() {
  document.getElementById("latModSensorManual").value = "";
  document.getElementById("lngModSensorManual").value = "";
  document.getElementById("parcela-sensor").selectedIndex = 0;
  restaurarSelectorTipoSensor();
  limpiarSensorMapa(); 
}
