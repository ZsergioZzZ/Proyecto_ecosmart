let correoUsuario = "";

document.addEventListener("DOMContentLoaded", async () => {
  await alertaConfig_cargarParcelas();

  document.getElementById("select-parcela").addEventListener("change", async (e) => {
    const parcela = e.target.value;

    // Cargar sensores
    await alertaConfig_cargarSensores(parcela);

    // Buscar correo del usuario asociado
    try {
      const res = await fetch(`http://localhost:5000/configuracion-alertas/correo-usuario?parcela=${encodeURIComponent(parcela)}`);
      const data = await res.json();
      if (data && data.correo) {
      correoUsuario = data.correo;
      localStorage.setItem("correoUsuario", correoUsuario);  
    }else {
        console.warn("No se encontró correo para esta parcela.");
      }
    } catch (err) {
      console.error("Error al obtener correo del usuario:", err);
    }

  });


  const botonGuardar = document.querySelector("button");
  botonGuardar.addEventListener("click", alertaConfig_guardar);
});

async function alertaConfig_cargarParcelas() {
  try {
    const res = await fetch("http://localhost:5000/configuracion-alertas/parcelas");
    const parcelas = await res.json();
    const select = document.getElementById("select-parcela");

    select.innerHTML = '<option value="">Seleccione una parcela</option>';

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
  } catch (error) {
    console.error("Error al cargar parcelas:", error);
  }
}


async function alertaConfig_cargarSensores(parcela) {
  try {
    const res = await fetch(`http://localhost:5000/configuracion-alertas/sensores?parcela=${encodeURIComponent(parcela)}`);
    const sensores = await res.json();
    const select = document.getElementById("select-sensor");

    select.innerHTML = '<option value="">Seleccione un sensor</option>';

    sensores.sort((a, b) => a.tipo.localeCompare(b.tipo));  // Ordenar por tipo

    sensores.forEach(s => {
      const option = document.createElement("option");
      option.value = s.tipo;
      option.textContent = s.tipo;
      select.appendChild(option);
    });

  } catch (error) {
    console.error("Error al cargar sensores:", error);
  }
}


async function alertaConfig_guardar(event) {
  event.preventDefault();

  const nombreAlerta = document.getElementById("nombre-alerta").value.trim();
  const parcela = document.getElementById("select-parcela").value;
  const sensor = document.getElementById("select-sensor").value.trim().toLowerCase();
  const notificaciones = Array.from(document.querySelectorAll("input[name='notificacion']:checked")).map(el => el.value);
  const correoSeleccionado = document.getElementById("checkbox-correo").checked;
  const appSeleccionada = document.getElementById("checkbox-app").checked;


  if (!nombreAlerta || !parcela || !sensor) {
    alert("Por favor completa todos los campos obligatorios.");
    return;
  }

  if (notificaciones.length === 0) {
    alert("Debes seleccionar al menos una forma de notificación: Correo o App.");
    return;
  }

  if (sensor.includes("nutriente")) {
    const campos = [
      "n-alto", "n-desc-alto", "n-bajo", "n-desc-bajo",
      "p-alto", "p-desc-alto", "p-bajo", "p-desc-bajo",
      "k-alto", "k-desc-alto", "k-bajo", "k-desc-bajo"
    ];

    for (let id of campos) {
      const campo = document.getElementById(id);
      if (!campo || campo.value.trim() === "") {
        alert("Por favor completa todos los campos de nutrientes.");
        return;
      }
    }

  const datos = {
  nombre_alerta: nombreAlerta,
  parcela: parcela,
  sensor: sensor,
  notificaciones: notificaciones,
  correo: correoSeleccionado ? correoUsuario : null,
  correo_app: appSeleccionada ? correoUsuario : null
  };

  // Y dependiendo del tipo de sensor:
  if (sensor.includes("nutriente")) {
  Object.assign(datos, {
    n_alto: parseFloat(document.getElementById("n-alto").value),
    n_desc_alto: document.getElementById("n-desc-alto").value.trim(),
    n_bajo: parseFloat(document.getElementById("n-bajo").value),
    n_desc_bajo: document.getElementById("n-desc-bajo").value.trim(),

    p_alto: parseFloat(document.getElementById("p-alto").value),
    p_desc_alto: document.getElementById("p-desc-alto").value.trim(),
    p_bajo: parseFloat(document.getElementById("p-bajo").value),
    p_desc_bajo: document.getElementById("p-desc-bajo").value.trim(),

    k_alto: parseFloat(document.getElementById("k-alto").value),
    k_desc_alto: document.getElementById("k-desc-alto").value.trim(),
    k_bajo: parseFloat(document.getElementById("k-bajo").value),
    k_desc_bajo: document.getElementById("k-desc-bajo").value.trim()
  });
  } else {
  Object.assign(datos, {
    umbral_alto: parseFloat(document.getElementById("umbral-alto").value),
    descripcion_alto: document.getElementById("descripcion-alto").value.trim(),
    umbral_bajo: parseFloat(document.getElementById("umbral-bajo").value),
    descripcion_bajo: document.getElementById("descripcion-bajo").value.trim()
  });
  }


    return enviarAlerta(datos);
  }

  // Si es sensor normal
  const umbralAlto = parseFloat(document.getElementById("umbral-alto").value);
  const descripcionAlto = document.getElementById("descripcion-alto").value.trim();
  const umbralBajo = parseFloat(document.getElementById("umbral-bajo").value);
  const descripcionBajo = document.getElementById("descripcion-bajo").value.trim();

  if (
    isNaN(umbralAlto) || descripcionAlto === "" ||
    isNaN(umbralBajo) || descripcionBajo === ""
  ) {
    alert("Por favor completa todos los campos de umbrales generales.");
    return;
  }

  const datos = {
    nombre_alerta: nombreAlerta,
    parcela: parcela,
    sensor: sensor,
    umbral_alto: umbralAlto,
    descripcion_alto: descripcionAlto,
    umbral_bajo: umbralBajo,
    descripcion_bajo: descripcionBajo,
    notificaciones: notificaciones,
    correo: correoSeleccionado ? correoUsuario : null,
    correo_app: appSeleccionada ? correoUsuario : null

  };

  enviarAlerta(datos);
}

async function enviarAlerta(datos) {
  try {
    const res = await fetch("http://localhost:5000/configuracion-alertas/nueva", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos)
    });

    const resultado = await res.json();

    if (res.ok) {
      alert("Alerta configurada correctamente.");
      limpiarFormulario();
    } else {
      alert("Error: " + resultado.error);
    }
  } catch (error) {
    console.error("Error al guardar alerta:", error);
    alert("No se pudo conectar con el servidor.");
  }
}




document.getElementById("select-sensor").addEventListener("change", function () {
  const valor = this.value.trim().toLowerCase();
  const esNutrientes = valor.includes("nutrientes");

  const divGenerales = document.getElementById("campos-generales");
  const divNutrientes = document.getElementById("campos-nutrientes");

  if (esNutrientes) {
    divGenerales.style.display = "none";
    divNutrientes.style.display = "block";
  } else {
    divGenerales.style.display = "block";
    divNutrientes.style.display = "none";
  }
});



function limpiarFormulario() {
  document.getElementById("nombre-alerta").value = "";
  document.getElementById("select-parcela").value = "";
  document.getElementById("select-sensor").value = "";

  // Umbrales generales
  document.getElementById("umbral-alto").value = "";
  document.getElementById("descripcion-alto").value = "";
  document.getElementById("umbral-bajo").value = "";
  document.getElementById("descripcion-bajo").value = "";

  // Umbrales nutrientes
  ["n", "p", "k"].forEach(letra => {
    document.getElementById(`${letra}-alto`).value = "";
    document.getElementById(`${letra}-desc-alto`).value = "";
    document.getElementById(`${letra}-bajo`).value = "";
    document.getElementById(`${letra}-desc-bajo`).value = "";
  });

  // Checkboxes
  document.getElementById("checkbox-correo").checked = false;
  document.getElementById("checkbox-app").checked = false;

  // Campos visuales
  document.getElementById("campos-generales").style.display = "block";
  document.getElementById("campos-nutrientes").style.display = "none";
}
