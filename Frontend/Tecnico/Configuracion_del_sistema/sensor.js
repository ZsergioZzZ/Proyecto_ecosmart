const mapSensor = L.map('mapSensor');
let markerSensor = null;
let modoSensor = null; 

// Centrar mapa en ubicación del dispositivo
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      mapSensor.setView([lat, lng], 14);
    },
    () => {
      mapSensor.setView([-33.4489, -70.6693], 14);
    }
  );
} else {
  mapSensor.setView([-33.4489, -70.6693], 14);
}

// Cargar mapa
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles © Esri'
}).addTo(mapSensor);


// Evento click en mapa
mapSensor.on('click', function (e) {
  if (modoSensor === 'agregar') {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    setSensorLocation(lat, lng);
  }
});

// Establecer marcador en el mapa
function setSensorLocation(lat, lng) {
  const latlng = [lat, lng];

  if (markerSensor) {
    markerSensor.setLatLng(latlng);
  } else {
    markerSensor = L.marker(latlng, { draggable: false }).addTo(mapSensor);

    markerSensor.on('dragend', (e) => {
      if (modoSensor === 'modificar') {
        const pos = e.target.getLatLng();
        document.getElementById("sensorCoords").value = JSON.stringify({
          lat: pos.lat,
          lng: pos.lng
        });
      }
    });
  }

  document.getElementById("sensorCoords").value = JSON.stringify({ lat, lng });
  if (modoSensor !== 'modificar') {
    mapSensor.setView(latlng);
  }
}

// Agregar punto manual
function agregarPuntoSensorManual() {
  const lat = parseFloat(document.getElementById("latSensorManual").value);
  const lng = parseFloat(document.getElementById("lngSensorManual").value);

  if (isNaN(lat) || isNaN(lng)) {
    alert("Por favor ingresa coordenadas válidas.");
    return;
  }

  setSensorLocation(lat, lng);

  // Limpiar inputs
  document.getElementById("latSensorManual").value = "";
  document.getElementById("lngSensorManual").value = "";
}

// Limpiar formulario y mapa
function limpiarSensorForm() {
  document.getElementById("parcelaAsociada").value = "";
  document.querySelectorAll('input[name="tipoSensor"]:checked').forEach(cb => cb.checked = false);
  document.getElementById("numeroSensor").value = "";
  document.getElementById("sensorCoords").value = "";
  if (markerSensor) {
    mapSensor.removeLayer(markerSensor);
    markerSensor = null;
  }
  modoSensor = null;
  resaltarBotonActivo(null);
}

// Cargar parcelas desde backend
function cargarParcelas() {
    const correo = localStorage.getItem("correoUsuario");
  if (!correo) {
    alert("No hay usuario logueado");
    return;
  }
  fetch("http://localhost:5000/api/parcelas_ag_sensores?correo=" + encodeURIComponent(correo))

    .then(res => res.json())
    .then(parcelas => {
      const select = document.getElementById("parcelaAsociada");
      select.innerHTML = '<option value="">Seleccione una parcela</option>';
      parcelas.sort((a, b) => {
        const nombreA = a.nombre.toLowerCase();
        const nombreB = b.nombre.toLowerCase();
        if (nombreA < nombreB) return -1;
        if (nombreA > nombreB) return 1;
        return a.numero - b.numero;
      });

      parcelas.forEach(parcela => {
        const texto = `${parcela.nombre} - Parcela ${parcela.numero}`;
        const option = document.createElement("option");
        option.value = texto;
        option.textContent = texto;
        select.appendChild(option);
      });

    })
    .catch(err => {
      console.error("Error al cargar parcelas:", err);
      alert("No se pudieron cargar las parcelas.");
    });
}

// Guardar sensor
function guardarSensor() {
  const parcela = document.getElementById("parcelaAsociada").value;
  const tiposSeleccionados = Array.from(document.querySelectorAll('input[name="tipoSensor"]:checked')).map(cb => cb.value);
  const coordsRaw = document.getElementById("sensorCoords").value;

  if (!parcela || tiposSeleccionados.length === 0 || !coordsRaw) {
    alert("Todos los campos y la ubicación son obligatorios.");
    return;
  }

  const coords = JSON.parse(coordsRaw);

  fetch("http://localhost:5000/api/sensores-list")
    .then(res => res.json())
    .then(sensores => {
      const sensoresDeParcela = sensores.filter(s => s.parcela === parcela);
      const tiposExistentes = sensoresDeParcela.map(s => s.tipo);

      const tiposRepetidos = tiposSeleccionados.filter(tipo => tiposExistentes.includes(tipo));

      if (tiposRepetidos.length > 0) {
        alert("Ya existe un sensor de tipo: " + tiposRepetidos.join(", ") + " para esta parcela.");
        return Promise.reject("tipo duplicado");
      }

      const promesas = tiposSeleccionados.map(tipo => {
        const datos = {
          parcela,
          tipo,
          ubicacion: coords
        };

        return fetch("http://localhost:5000/api/sensores", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(datos)
        });
      });

      return Promise.all(promesas);
    })
    .then(resultados => {
      if (resultados) {
        alert("Sensores guardados exitosamente.");
      }
    })
    .catch(err => {
      if (err !== "tipo duplicado") {
        console.error(err);
        alert("Error al guardar sensores: " + err.message);
      }
    })
    .finally(() => {

      // Eliminar marcador
      if (markerSensor) {
        mapSensor.removeLayer(markerSensor);
        markerSensor = null;
      }

      // Limpiar formulario
      document.getElementById("parcelaAsociada").value = "";
      document.querySelectorAll('input[name="tipoSensor"]:checked').forEach(cb => cb.checked = false);
      document.getElementById("sensorCoords").value = "";

      // Eliminar parcela dibujada
      if (window.parcelaDibujada) {
        mapSensor.removeLayer(window.parcelaDibujada);
        window.parcelaDibujada = null;
      }
    });
}






// Modos de edición
function modoSensorAgregar() {
  modoSensor = 'agregar';
  if (markerSensor) markerSensor.dragging.disable();
  resaltarBotonActivo("btn-sensor-agregar");
}

function modoSensorModificar() {
  if (!markerSensor) {
    alert("Primero debes agregar el sensor.");
    return;
  }
  modoSensor = 'modificar';
  markerSensor.dragging.enable();
  resaltarBotonActivo("btn-sensor-modificar");
}


// Botón activo visual
function resaltarBotonActivo(id) {
  document.querySelectorAll(".leaflet-control button").forEach(btn => {
    btn.style.backgroundColor = "white";
    btn.style.fontWeight = "normal";
  });

  if (id) {
    const activo = document.getElementById(id);
    if (activo) {
      activo.style.backgroundColor = "#e6e6e6";
      activo.style.fontWeight = "bold";
    }
  }
}

// Control visual en el mapa
L.Control.ControlesSensor = L.Control.extend({
  onAdd: function () {
    const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
    div.style.backgroundColor = 'white';
    div.style.padding = '10px';
    div.style.borderRadius = '6px';
    div.style.boxShadow = '0 0 6px rgba(0,0,0,0.3)';
    div.style.fontSize = '12px';
    div.style.minWidth = '130px';

    div.innerHTML = `
      <button id="btn-sensor-agregar" onclick="modoSensorAgregar()" style="margin: 2px; display: flex; align-items: center; gap: 6px;">
        <span style="color: blue;">➕</span> Agregar punto
      </button><br/>
      <button id="btn-sensor-modificar" onclick="modoSensorModificar()" style="margin: 2px; display: flex; align-items: center; gap: 6px;">
        <span style="color: orange;">✏️</span> Modificar punto
      </button><br/>
      <button onclick="limpiarSensorForm()" style="margin: 2px; display: flex; align-items: center; gap: 6px;">
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
}
L.control.controlesSensor({ position: 'topright' }).addTo(mapSensor);




document.getElementById("parcelaAsociada").addEventListener("change", function () {
  const valor = this.value;
  // Si no hay valor válido, eliminar dibujo y salir
  if (!valor || !valor.includes(" - Parcela ")) {
    if (window.parcelaDibujada) {
      mapSensor.removeLayer(window.parcelaDibujada);
      window.parcelaDibujada = null;
    }
    return;
  }

  const [nombre, resto] = valor.split(" - Parcela ");
  const numero = parseInt(resto);

fetch(`http://localhost:5000/api/parcela?nombre=${encodeURIComponent(nombre)}&numero=${numero}`)

    .then(res => res.json())
    .then(data => {
      if (!data.puntos) return;

      const puntos = data.puntos.map(p => [p.lat, p.lng]);

      // Eliminar parcela anterior si ya había una
      if (window.parcelaDibujada) {
        mapSensor.removeLayer(window.parcelaDibujada);
      }

      // Dibujar nueva parcela
      window.parcelaDibujada = L.polygon(puntos, { color: "red", fillOpacity: 0.15 }).addTo(mapSensor);
      mapSensor.fitBounds(window.parcelaDibujada.getBounds());
    })
    .catch(err => {
      console.error("Error al obtener la parcela:", err);
      alert("No se pudo cargar la parcela seleccionada.");
    });
});



// Inicializar
window.addEventListener("load", () => {
  mapSensor.invalidateSize();
  cargarParcelas();
});


