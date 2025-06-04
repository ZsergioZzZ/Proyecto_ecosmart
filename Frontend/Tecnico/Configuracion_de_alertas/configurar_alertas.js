// Iniciar carga al cargar el DOM
document.addEventListener("DOMContentLoaded", async () => {
  await alertaConfig_cargarParcelas();

  document.getElementById("select-parcela").addEventListener("change", async (e) => {
    const parcela = e.target.value;
    await alertaConfig_cargarSensores(parcela);
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
  const sensor = document.getElementById("select-sensor").value;
  const umbralAlto = parseFloat(document.getElementById("umbral-alto").value);
  const descripcionAlto = document.getElementById("descripcion-alto").value.trim();
  const umbralBajo = parseFloat(document.getElementById("umbral-bajo").value);
  const descripcionBajo = document.getElementById("descripcion-bajo").value.trim();
  const notificaciones = Array.from(document.querySelectorAll("input[name='notificacion']:checked")).map(el => el.value);

  if (
    !nombreAlerta ||
    !parcela ||
    !sensor ||
    isNaN(umbralAlto) || descripcionAlto === "" ||
    isNaN(umbralBajo) || descripcionBajo === ""
  ) {
    alert("Por favor completa todos los campos obligatorios.");
    return;
  }


  if (notificaciones.length === 0) {
    alert("Debes seleccionar al menos una forma de notificación: Correo o App.");
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
    notificaciones: notificaciones
  };

  try {
    const res = await fetch("http://localhost:5000/configuracion-alertas/nueva", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos)
    });

    const resultado = await res.json();

    if (res.ok) {
      alert("✅ Alerta configurada correctamente.");
    } else {
      alert("❌ Error: " + resultado.error);
    }
  } catch (error) {
    console.error("Error de red al guardar alerta:", error);
    alert("❌ No se pudo conectar con el servidor.");
  }
}
