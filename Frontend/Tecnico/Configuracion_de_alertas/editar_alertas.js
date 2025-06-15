document.addEventListener("DOMContentLoaded", async () => {
  await cargarParcelasEditar();

  // ✅ Al cambiar la parcela, se limpian sensores, alertas y campos
  document.getElementById("parcela-editar").addEventListener("change", async () => {
    const parcela = document.getElementById("parcela-editar").value;
    limpiarCampos(true, true); // <- AQUÍ
    await cargarSensoresEditar(parcela);
  });

  // ✅ Al cambiar el sensor, se limpian solo las alertas y campos (se conserva parcela)
  document.getElementById("sensor-editar").addEventListener("change", async () => {
    const parcela = document.getElementById("parcela-editar").value;
    const sensor = document.getElementById("sensor-editar").value;
    limpiarCampos(false, true); // <- AQUÍ
    await cargarAlertasEditar(parcela, sensor);
  });

  // ✅ Al cambiar la alerta, se limpian solo los campos (se conserva parcela y sensor)
  document.getElementById("alerta-editar").addEventListener("change", async () => {
    const nombre_alerta = document.getElementById("alerta-editar").value;
    if (nombre_alerta) {
      limpiarCampos(false, false); // <- AQUÍ
      await cargarDatosDeAlerta(nombre_alerta);
    }
  });
});



async function cargarParcelasEditar() {
  const correo = localStorage.getItem("correoUsuario");
  if (!correo) {
    alert("No hay usuario logueado.");
    return;
  }
  const res = await fetch(`http://localhost:5000/configuracion-alertas/parcelas-usuario?correo=${encodeURIComponent(correo)}`);
  const parcelas = await res.json();
  const select = document.getElementById("parcela-editar");
  select.innerHTML = `<option value="">Seleccione una parcela</option>`;

  parcelas.sort((a, b) => {
    const nombreA = a.nombre.toLowerCase();
    const nombreB = b.nombre.toLowerCase();
    if (nombreA < nombreB) return -1;
    if (nombreA > nombreB) return 1;
    return a.numero - b.numero;
  });

  parcelas.forEach(p => {
    const nombreCompleto = `${p.nombre} - Parcela ${p.numero}`;
    const option = document.createElement("option");
    option.value = nombreCompleto;
    option.textContent = nombreCompleto;
    select.appendChild(option);
  });
}


async function cargarSensoresEditar(parcela) {
  const res = await fetch(`http://localhost:5000/configuracion-alertas/sensores?parcela=${encodeURIComponent(parcela)}`);
  const sensores = await res.json();
  const select = document.getElementById("sensor-editar");
  select.innerHTML = `<option value="">Seleccione un sensor</option>`;
  sensores.forEach(s => {
    const option = document.createElement("option");
    option.value = s.tipo;
    option.textContent = s.tipo;
    select.appendChild(option);
  });
}

async function cargarAlertasEditar(parcela, sensor) {
  try {
    const res = await fetch(`http://localhost:5000/configuracion-alertas/alertas?parcela=${encodeURIComponent(parcela)}&sensor=${encodeURIComponent(sensor)}`);
    const alertas = await res.json();
    const select = document.getElementById("alerta-editar");
    select.innerHTML = `<option value="">Seleccione una alerta</option>`;

    alertas.sort((a, b) => a.nombre_alerta.localeCompare(b.nombre_alerta));

    alertas.forEach(a => {
      const option = document.createElement("option");
      option.value = a.nombre_alerta;
      option.textContent = a.nombre_alerta;
      select.appendChild(option);
    });
  } catch (error) {
    console.error("Error al cargar alertas:", error);
  }
}



async function cargarDatosDeAlerta(nombre_alerta) {
  const parcela = document.getElementById("parcela-editar").value;
  const sensor = document.getElementById("sensor-editar").value;

  const res = await fetch(`http://localhost:5000/configuracion-alertas/detalle?nombre_alerta=${encodeURIComponent(nombre_alerta)}&parcela=${encodeURIComponent(parcela)}&sensor=${encodeURIComponent(sensor)}`);
  const data = await res.json();

  document.getElementById("editNombreAlerta").value = data.nombre_alerta;

  const isNutriente = data.sensor.toLowerCase().includes("nutriente");
  document.getElementById("campos-generales-editar").style.display = isNutriente ? "none" : "block";
  document.getElementById("campos-nutrientes-editar").style.display = isNutriente ? "block" : "none";

  if (isNutriente) {
    const n = data.nutrientes.n, p = data.nutrientes.p, k = data.nutrientes.k;
    document.getElementById("edit-n-alto").value = n.umbral_alto;
    document.getElementById("edit-n-desc-alto").value = n.descripcion_alto;
    document.getElementById("edit-n-bajo").value = n.umbral_bajo;
    document.getElementById("edit-n-desc-bajo").value = n.descripcion_bajo;
    document.getElementById("edit-p-alto").value = p.umbral_alto;
    document.getElementById("edit-p-desc-alto").value = p.descripcion_alto;
    document.getElementById("edit-p-bajo").value = p.umbral_bajo;
    document.getElementById("edit-p-desc-bajo").value = p.descripcion_bajo;
    document.getElementById("edit-k-alto").value = k.umbral_alto;
    document.getElementById("edit-k-desc-alto").value = k.descripcion_alto;
    document.getElementById("edit-k-bajo").value = k.umbral_bajo;
    document.getElementById("edit-k-desc-bajo").value = k.descripcion_bajo;
  } else {
    document.getElementById("editUmbralAlto").value = data.umbral_alto;
    document.getElementById("editDescripcionAlto").value = data.descripcion_alto;
    document.getElementById("editUmbralBajo").value = data.umbral_bajo;
    document.getElementById("editDescripcionBajo").value = data.descripcion_bajo;
  }

  document.getElementById("edit-check-correo").checked = data.notificaciones.includes("correo");
  document.getElementById("edit-check-app").checked = data.notificaciones.includes("app");
}

async function cargarAlertasPorSensorYParcela(parcela, sensor) {
  try {
    const res = await fetch(`http://localhost:5000/configuracion-alertas/alertas?parcela=${encodeURIComponent(parcela)}&sensor=${encodeURIComponent(sensor)}`);
    const datos = await res.json();
    const select = document.getElementById("alerta-editar");

    select.innerHTML = '<option value="">Seleccione una alerta</option>';
    datos.forEach(alerta => {
      const option = document.createElement("option");
      option.value = alerta._id;
      option.textContent = alerta.nombre_alerta;
      select.appendChild(option);
    });
  } catch (err) {
    console.error("Error al cargar alertas:", err);
  }
}



async function guardarCambiosAlerta() {
  const nombre_alerta = document.getElementById("editNombreAlerta").value.trim();
  const parcela = document.getElementById("parcela-editar").value;
  const sensor = document.getElementById("sensor-editar").value.trim().toLowerCase();
  const original_alerta = document.getElementById("alerta-editar").value;


  const notificaciones = [];
  const correoChecked = document.getElementById("edit-check-correo").checked;
  const appChecked = document.getElementById("edit-check-app").checked;

  if (correoChecked) notificaciones.push("correo");
  if (appChecked) notificaciones.push("app");

  // ❌ Validación: al menos uno debe estar seleccionado
  if (!correoChecked && !appChecked) {
  alert("Debes seleccionar al menos una forma de notificación: Correo o App.");
  return;
  }


  let correo = null;
  let correo_app = null;

  if (notificaciones.includes("correo")) {
    correo = document.getElementById("edit-correo")?.value?.trim();
    if (!correo) {
      const res = await fetch(`http://localhost:5000/configuracion-alertas/correo-usuario?parcela=${encodeURIComponent(parcela)}`);
      const data = await res.json();
      correo = data.correo || null;
    }
  }

  if (notificaciones.includes("app")) {
    correo_app = document.getElementById("edit-correo-app")?.value?.trim();
    if (!correo_app) {
      const res = await fetch(`http://localhost:5000/configuracion-alertas/correo-usuario?parcela=${encodeURIComponent(parcela)}`);
      const data = await res.json();
      correo_app = data.correo || null;
    }
  }

  const datos = {
    nombre_alerta,
    parcela,
    sensor,
    notificaciones,
    correo,
    correo_app
  };

  if (sensor.includes("nutriente")) {
    datos.nutrientes = {
      n: {
        umbral_alto: parseFloat(document.getElementById("edit-n-alto").value),
        descripcion_alto: document.getElementById("edit-n-desc-alto").value.trim(),
        umbral_bajo: parseFloat(document.getElementById("edit-n-bajo").value),
        descripcion_bajo: document.getElementById("edit-n-desc-bajo").value.trim()
      },
      p: {
        umbral_alto: parseFloat(document.getElementById("edit-p-alto").value),
        descripcion_alto: document.getElementById("edit-p-desc-alto").value.trim(),
        umbral_bajo: parseFloat(document.getElementById("edit-p-bajo").value),
        descripcion_bajo: document.getElementById("edit-p-desc-bajo").value.trim()
      },
      k: {
        umbral_alto: parseFloat(document.getElementById("edit-k-alto").value),
        descripcion_alto: document.getElementById("edit-k-desc-alto").value.trim(),
        umbral_bajo: parseFloat(document.getElementById("edit-k-bajo").value),
        descripcion_bajo: document.getElementById("edit-k-desc-bajo").value.trim()
      }
    };
  } else {
    datos.umbral_alto = parseFloat(document.getElementById("editUmbralAlto").value);
    datos.descripcion_alto = document.getElementById("editDescripcionAlto").value.trim();
    datos.umbral_bajo = parseFloat(document.getElementById("editUmbralBajo").value);
    datos.descripcion_bajo = document.getElementById("editDescripcionBajo").value.trim();
  }

  fetch(`http://localhost:5000/configuracion-alertas/modificar?original=${encodeURIComponent(original_alerta)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos)
  })

  .then(res => res.json())
  .then(res => {
    alert("✅ Alerta actualizada correctamente");
      limpiarCampos(true, true);
      document.getElementById("parcela-editar").selectedIndex = 0;

  })
  .catch(err => {
    console.error("Error al actualizar alerta:", err);
    alert("❌ Error al guardar cambios");
  });
}


function eliminarAlerta() {
  const nombre = document.getElementById("alerta-editar").value;
  const parcela = document.getElementById("parcela-editar").value;
  const sensor = document.getElementById("sensor-editar").value;

  if (!confirm("¿Estás seguro de eliminar esta alerta?")) return;

  fetch(`http://localhost:5000/configuracion-alertas/eliminar?nombre_alerta=${encodeURIComponent(nombre)}&parcela=${encodeURIComponent(parcela)}&sensor=${encodeURIComponent(sensor)}`, {
    method: "DELETE"
  })
    .then(res => res.json())
    .then(res => {
      alert("🗑️ Alerta eliminada correctamente");
      location.reload();
    })
    .catch(err => {
      console.error("Error al eliminar alerta:", err);
      alert("❌ Error al eliminar la alerta");
    });
}

function limpiarCampos(parcela = false, sensor = false) {
  if (parcela) {
    document.getElementById("sensor-editar").innerHTML = `<option value="">Seleccione un sensor</option>`;
    document.getElementById("alerta-editar").innerHTML = `<option value="">Seleccione una alerta</option>`;
  }

  if (sensor) {
    document.getElementById("alerta-editar").innerHTML = `<option value="">Seleccione una alerta</option>`;
  }

  document.getElementById("editNombreAlerta").value = "";

  // Campos normales
  document.getElementById("editUmbralAlto").value = "";
  document.getElementById("editDescripcionAlto").value = "";
  document.getElementById("editUmbralBajo").value = "";
  document.getElementById("editDescripcionBajo").value = "";

  // Campos nutrientes
  ["n", "p", "k"].forEach(x => {
    document.getElementById(`edit-${x}-alto`).value = "";
    document.getElementById(`edit-${x}-desc-alto`).value = "";
    document.getElementById(`edit-${x}-bajo`).value = "";
    document.getElementById(`edit-${x}-desc-bajo`).value = "";
  });

  // Notificaciones
  document.getElementById("edit-check-correo").checked = false;
  document.getElementById("edit-check-app").checked = false;
  const inputCorreo = document.getElementById("edit-correo");
const inputCorreoApp = document.getElementById("edit-correo-app");

if (inputCorreo) {
  inputCorreo.value = "";
  inputCorreo.style.display = "none";
}

if (inputCorreoApp) {
  inputCorreoApp.value = "";
  inputCorreoApp.style.display = "none";
}
}
