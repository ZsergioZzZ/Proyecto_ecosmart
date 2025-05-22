// Inicializar el mapa
const map = L.map('map'); 

// Intentar geolocalización
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      map.setView([lat, lng], 14);
    },
    () => {
      map.setView([-33.4489, -70.6693], 14);
    }
  );
} else {
  map.setView([-33.4489, -70.6693], 14);
}

L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles © Esri'
}).addTo(map);

let drawnPoints = [];
let markers = [];
let polygon = null;
let modo = null;

function drawPolygon() {
  if (polygon) {
    map.removeLayer(polygon);
  }
  if (drawnPoints.length >= 3) {
    polygon = L.polygon(drawnPoints, { color: 'red', fillOpacity: 0.15 }).addTo(map);
  }
  document.getElementById("parcelPoints").value = JSON.stringify(drawnPoints);
}

function addPoint(latlng) {
  drawnPoints.push(latlng);

  const marker = L.marker(latlng, {
    draggable: true
  }).addTo(map);

  marker.on('dragstart', () => {
    map.dragging.disable();
  });

  marker.on('dragend', (e) => {
    map.dragging.enable();
    if (modo === 'modificar') {
      const i = markers.indexOf(marker);
      drawnPoints[i] = [e.target.getLatLng().lat, e.target.getLatLng().lng];
      drawPolygon();
    }
  });

  if (modo !== 'modificar') {
    marker.dragging.disable();
  }

  marker.on('click', () => {
    const index = markers.indexOf(marker);
    if (modo === 'eliminar') {
      map.removeLayer(marker);
      drawnPoints.splice(index, 1);
      markers.splice(index, 1);
      drawPolygon();
    }
  });

  markers.push(marker);
  drawPolygon();
}

function limpiarParcela() {
  drawnPoints = [];
  markers.forEach(marker => map.removeLayer(marker));
  markers = [];
  if (polygon) {
    map.removeLayer(polygon);
    polygon = null;
  }
  drawPolygon();
  desactivarModos();
}

function limpiarFormulario() {
  document.getElementById("nombre").value = "";
  document.getElementById("numero").value = "";
  document.getElementById("ubicacion").value = "";
  document.getElementById("cultivo").value = "";
  document.getElementById("latManual").value = "";
  document.getElementById("lngManual").value = "";
}

function guardarParcela() {
  const nombre = document.getElementById("nombre").value.trim();
  const ubicacion = document.getElementById("ubicacion").value.trim();
  const cultivo = document.getElementById("cultivo").value.trim();

  if (!nombre || !ubicacion || !cultivo || drawnPoints.length < 3) {
    alert("Completa todos los campos y asegúrate de marcar al menos 3 puntos en el mapa.");
    return;
  }

  fetch("http://localhost:5000/api/parcelas-list")
    .then(res => res.json())
    .then(parcelas => {
      const parcelasConNombre = parcelas.filter(p => p.nombre === nombre);
      const siguienteNumero = parcelasConNombre.length > 0
        ? Math.max(...parcelasConNombre.map(p => parseInt(p.numero))) + 1
        : 1;

      const datos = {
        nombre,
        numero: siguienteNumero,
        ubicacion,
        cultivo,
        puntos: drawnPoints
      };

      return fetch("http://localhost:5000/api/parcelas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(datos)
      });
    })
    .then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Error desconocido");
      alert(result.mensaje);
      limpiarParcela();
      limpiarFormulario();
      desactivarModos();
    })
    .catch(err => {
      console.error(err);
      alert(err.message);
    });
}

function desactivarModos() {
  modo = null;
  markers.forEach(marker => marker.dragging.disable());
}

function activarAgregar() {
  desactivarModos();
  modo = 'agregar';
  resaltarBotonActivo("btn-agregar");
}

function activarEliminar() {
  desactivarModos();
  modo = 'eliminar';
  resaltarBotonActivo("btn-eliminar");
}

function activarModificar() {
  desactivarModos();
  modo = 'modificar';
  markers.forEach(marker => {
    marker.dragging.enable();
  });
  resaltarBotonActivo("btn-modificar");
}

L.Control.ControlesParcela = L.Control.extend({
  onAdd: function () {
    const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
    div.style.backgroundColor = 'white';
    div.style.padding = '10px';
    div.style.borderRadius = '6px';
    div.style.boxShadow = '0 0 6px rgba(0,0,0,0.3)';
    div.style.fontSize = '12px';
    div.style.minWidth = '130px';

    div.innerHTML = `
    <button id="btn-agregar" onclick="activarAgregar()" style="margin: 2px; display: flex; align-items: center; gap: 6px;">
        <span style="color: blue;">➕</span> Agregar punto
    </button><br/>
    <button id="btn-eliminar" onclick="activarEliminar()" style="margin: 2px; display: flex; align-items: center; gap: 6px;">
        <span style="color: red;">❌</span> Eliminar punto
    </button><br/>
    <button id="btn-modificar" onclick="activarModificar()" style="margin: 2px; display: flex; align-items: center; gap: 6px;">
        <span style="color: orange;">✏️</span> Modificar punto
    </button><br/>
    <button onclick="limpiarParcela()" style="margin: 2px; display: flex; align-items: center; gap: 6px;">
        <span style="color: gray;">🗑️</span> Limpiar mapa
    </button>
    `;

    L.DomEvent.disableClickPropagation(div);
    return div;
  },
  onRemove: function () {}
});

function resaltarBotonActivo(id) {
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

L.control.controlesParcela = function (opts) {
  return new L.Control.ControlesParcela(opts);
}
L.control.controlesParcela({ position: 'topright' }).addTo(map);

map.on('click', function (e) {
  if (modo === 'agregar') {
    const latlng = [e.latlng.lat, e.latlng.lng];
    addPoint(latlng);
    map.panTo(latlng);
  }
});

window.addEventListener("load", () => {
  setTimeout(() => {
    map.invalidateSize();
  }, 300);
});

function agregarPuntoManual() {
  const lat = parseFloat(document.getElementById("latManual").value);
  const lng = parseFloat(document.getElementById("lngManual").value);

  if (isNaN(lat) || isNaN(lng)) {
    alert("Por favor ingresa latitud y longitud válidas.");
    return;
  }

  const latlng = [lat, lng];
  addPoint(latlng);
  map.setView(latlng, 16);
  document.getElementById("latManual").value = "";
  document.getElementById("lngManual").value = "";
}


