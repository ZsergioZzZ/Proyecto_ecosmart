const mapMod = L.map("mapModificarParcelaParcela").setView([-33.4489, -70.6693], 14);

L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
  attribution: "Tiles © Esri",
  maxZoom: 19
}).addTo(mapMod);

if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      mapMod.setView([lat, lng], 14); 
    },
    () => {
      mapMod.setView([-33.4489, -70.6693], 14);
    }
  );
} else {
  mapMod.setView([-33.4489, -70.6693], 14);
}


let drawnPointsMod = [];
let markersMod = [];
let polygonMod = null;
let modoMod = null;

function drawPolygonMod() {
  if (polygonMod) mapMod.removeLayer(polygonMod);
  if (drawnPointsMod.length >= 3) {
    polygonMod = L.polygon(drawnPointsMod, { color: "red", fillOpacity: 0.15 }).addTo(mapMod);
  }
}

function addPointMod(latlng) {
  drawnPointsMod.push(latlng);
  const marker = L.marker(latlng, { draggable: true }).addTo(mapMod);

  marker.on("dragstart", () => mapMod.dragging.disable());
  marker.on("dragend", (e) => {
    mapMod.dragging.enable();
    if (modoMod === "modificar") {
      const i = markersMod.indexOf(marker);
      drawnPointsMod[i] = [e.target.getLatLng().lat, e.target.getLatLng().lng];
      drawPolygonMod();
    }
  });

  if (modoMod !== "modificar" && marker.dragging) {
    marker.dragging.disable();
  }

  marker.on("click", () => {
    const index = markersMod.indexOf(marker);
    if (modoMod === "eliminar") {
      mapMod.removeLayer(marker);
      drawnPointsMod.splice(index, 1);
      markersMod.splice(index, 1);
      drawPolygonMod();
    }
  });

  markersMod.push(marker);
  drawPolygonMod();
}

function limpiarMapaMod() {
  drawnPointsMod = [];
  markersMod.forEach(m => mapMod.removeLayer(m));
  markersMod = [];
  if (polygonMod) {
    mapMod.removeLayer(polygonMod);
    polygonMod = null;
  }
  drawPolygonMod();
  desactivarModosMod();
}

function activarAgregarMod() {
  desactivarModosMod();
  modoMod = "agregar";
  resaltarBotonActivoMod("btn-agregar-mod");
}

function activarEliminarMod() {
  desactivarModosMod();
  modoMod = "eliminar";
  resaltarBotonActivoMod("btn-eliminar-mod");
}

function activarModificarMod() {
  desactivarModosMod();
  modoMod = "modificar";
  markersMod.forEach(m => m.dragging.enable());
  resaltarBotonActivoMod("btn-modificar-mod");
}

function desactivarModosMod() {
  modoMod = null;
  markersMod.forEach(m => m.dragging.disable());
}

function activarModificarMod() {
  desactivarModosMod(); 
  modoMod = "modificar"; 
  markersMod.forEach(marker => {
    marker.dragging.enable(); 
  });
  resaltarBotonActivoMod("btn-modificar-mod"); 
}


function resaltarBotonActivoMod(id) {
  document.querySelectorAll(".leaflet-control button").forEach(btn => {
    btn.style.backgroundColor = "white";
    btn.style.fontWeight = "normal";
  });
  const activo = document.getElementById(id);
  if (activo) {
    activo.style.backgroundColor = "#e6e6e6";
    activo.style.fontWeight = "bold";
  }
}

L.Control.ControlesModificar = L.Control.extend({
  onAdd: function () {
    const div = L.DomUtil.create("div", "leaflet-bar leaflet-control leaflet-control-custom");
    div.style.backgroundColor = "white";
    div.style.padding = "10px";
    div.style.borderRadius = "6px";
    div.style.boxShadow = "0 0 6px rgba(0,0,0,0.3)";
    div.style.fontSize = "12px";
    div.style.minWidth = "130px";

  div.innerHTML = `
    <button id="btn-agregar-mod" onclick="activarAgregarMod()" style="margin: 2px; display: flex; align-items: center; gap: 6px;">
        <span style="color: blue;">➕</span> Agregar punto
    </button><br/>
    <button id="btn-eliminar-mod" onclick="activarEliminarMod()" style="margin: 2px; display: flex; align-items: center; gap: 6px;">
        <span style="color: red;">❌</span> Eliminar punto
    </button><br/>
    <button id="btn-modificar-mod" onclick="activarModificarMod()" style="margin: 2px; display: flex; align-items: center; gap: 6px;">
        <span style="color: orange;">✏️</span> Modificar punto
    </button><br/>
    <button onclick="limpiarMapaMod()" style="margin: 2px; display: flex; align-items: center; gap: 6px;">
        <span style="color: gray;">🗑️</span> Limpiar mapa
    </button>
  `;


    L.DomEvent.disableClickPropagation(div);
    return div;
  },
  onRemove: function () {}
});

L.control.controlesModificar = function (opts) {
  return new L.Control.ControlesModificar(opts);
};

L.control.controlesModificar({ position: "topright" }).addTo(mapMod);

mapMod.on("click", function (e) {
  if (modoMod === "agregar") {
    const latlng = [e.latlng.lat, e.latlng.lng];
    addPointMod(latlng);
    mapMod.panTo(latlng);
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const tipoSelect = document.getElementById("tipo-modificacion");
  const divParcela = document.getElementById("modificar-parcela");
  const divSensor = document.getElementById("modificar-sensor");

  if (!tipoSelect || !divParcela || !divSensor) {
    console.warn("Elementos de modificación no encontrados.");
    return;
  }

  tipoSelect.addEventListener("change", function () {
    const tipo = this.value;

    divParcela.style.display = tipo === "parcela" ? "block" : "none";
    divSensor.style.display = tipo === "sensor" ? "block" : "none";

    if (tipo === "parcela") {
      setTimeout(() => {
        mapMod.invalidateSize();
      }, 100);
    }
  });

  cargarParcelasModificar(); 
});




document.addEventListener("DOMContentLoaded", () => {
  cargarParcelasModificar();
});

async function cargarParcelasModificar() {
  try {
    const res = await fetch("http://localhost:5000/api/parcelas");
    if (!res.ok) throw new Error("Error en la respuesta del servidor");
    const parcelas = await res.json();

    const selectParcela = document.getElementById("parcela-modificar");
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

    selectParcela.addEventListener("change", activarModificarPuntos);

  } catch (err) {
    console.error("Error al cargar parcelas para modificar:", err);
  }
}


function activarModificarPuntos() {
  const seleccion = document.getElementById("parcela-modificar").value;
  if (!seleccion || !seleccion.includes(" - Parcela ")) {
    alert("Seleccione una parcela válida.");
    return;
  }

  const [nombre, numeroTexto] = seleccion.split(" - Parcela ");
  const numero = parseInt(numeroTexto);

fetch(`http://localhost:5000/api/parcela?nombre=${encodeURIComponent(nombre)}&numero=${numero}`)
  .then(res => res.json())
  .then(data => {
    console.log("🔄 Datos recibidos:", data); 
    if (!data.puntos || data.puntos.length < 3) {
      alert("La parcela no tiene suficientes puntos para modificar.");
      return;
    }

    limpiarMapaMod();

    data.puntos.forEach(p => {
      const latlng = [p.lat, p.lng];
      console.log("➕ Agregando punto:", latlng);
      addPointMod(latlng);
    });


    document.getElementById("nuevo-nombre").value = nombre;
    document.getElementById("nueva-ubicacion").value = data.ubicacion || "";
    document.getElementById("nuevo-cultivo").value = data.cultivo || "";

    const bounds = L.latLngBounds(drawnPointsMod);
    mapMod.fitBounds(bounds, { padding: [30, 30] });

    activarModificarMod();
  })
  .catch(err => {
    console.error("Error al cargar puntos de la parcela:", err);
    alert("No se pudo cargar la parcela.");
  });

}



function guardarCambiosParcela() {
  const seleccion = document.getElementById("parcela-modificar").value;
  const [nombre_original, num] = seleccion.split(" - Parcela ");
  const nuevo_nombre = document.getElementById("nuevo-nombre").value.trim() || nombre_original;
  const ubicacion = document.getElementById("nueva-ubicacion").value.trim();
  const cultivo = document.getElementById("nuevo-cultivo").value.trim();

  if (!ubicacion || !cultivo || drawnPointsMod.length < 3) {
    alert("Todos los campos y al menos 3 puntos son obligatorios.");
    return;
  }

  const datos = {
    nombre_original,
    nuevo_nombre,
    numero: parseInt(num),
    ubicacion,
    cultivo,
    puntos: drawnPointsMod.map(p => ({ lat: p[0], lng: p[1] }))

  };

  fetch("http://localhost:5000/parcelas", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos)
  })
    .then(res => res.json())
    .then(data => {
      if (data.error) throw new Error(data.error);
      alert(data.mensaje);
      limpiarMapaMod();  
      limpiarFormularioParcela();
      cargarParcelasModificar();
    })
    .catch(err => {
      console.error(err);
      alert("Error al modificar la parcela.");
    });
}

function eliminarParcela() {
  const seleccion = document.getElementById("parcela-modificar").value;

  if (!seleccion || !seleccion.includes(" - Parcela ")) {
    alert("Por favor selecciona una parcela válida.");
    return;
  }

  const [nombre, numeroTexto] = seleccion.split(" - Parcela ");
  const numero = parseInt(numeroTexto);

  if (!confirm(`¿Estás seguro de eliminar la parcela "${nombre}" número ${numero}?`)) return;

  fetch(`http://localhost:5000/parcelas?nombre=${encodeURIComponent(nombre)}&numero=${numero}`, {
    method: "DELETE"
  })
    .then(res => res.json())
    .then(data => {
      if (data.error) throw new Error(data.error);
      alert(data.mensaje);
      limpiarMapaMod();
      limpiarFormularioParcela();
      cargarParcelasModificar();
    })
    .catch(err => {
      console.error(err);
      alert("Error al eliminar la parcela.");
    });
}


function modificarPuntoParcelaManual() {
  let latRaw = document.getElementById("latModParcelaManual").value;
  let lngRaw = document.getElementById("lngModParcelaManual").value;

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

  const latlng = [lat, lng];
  addPointMod(latlng);            
  mapMod.setView(latlng, 17);     
  document.getElementById("latModParcelaManual").value = "";
  document.getElementById("lngModParcelaManual").value = "";
  activarModificarMod();         
}

function limpiarFormularioParcela() {
  document.getElementById("parcela-modificar").selectedIndex = 0;
  document.getElementById("nuevo-nombre").value = "";
  document.getElementById("nueva-ubicacion").value = "";
  document.getElementById("nuevo-cultivo").value = "";
  document.getElementById("latModParcelaManual").value = "";
  document.getElementById("lngModParcelaManual").value = "";
}
