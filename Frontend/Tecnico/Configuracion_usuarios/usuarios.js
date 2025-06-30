// usuarios.js

async function registrarUsuario() {
  const nombre    = document.getElementById("nombre").value.trim();
  const apellidos = document.getElementById("apellidos").value.trim();
  const email     = document.getElementById("email").value.trim();
  const password  = document.getElementById("password").value.trim();
  const telefono  = document.getElementById("telefono").value.trim();
  const rol       = document.getElementById("rol").value.trim();

  // 1) Validación de campos vacíos
  if (!nombre || !apellidos || !email || !password || !telefono || !rol) {
    alert("Por favor completa todos los campos.");
    return;
  }

  // 2) Validación de formato de email
  const emailRegex = /^[\w.-]+@[\w.-]+\.\w+$/;
  if (!emailRegex.test(email)) {
    alert("Error: Email inválido. Asegúrate de usar formato usuario@dominio.ext");
    return;
  }

  // 3) Validación de contraseña
  if (password.length < 8 || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    alert("La contraseña debe tener al menos 8 caracteres, una mayúscula y un número.");
    return;
  }

  // 4) Validación de teléfono
  if (!/^\d{9}$/.test(telefono) || !telefono.startsWith("9")) {
    alert("El teléfono debe comenzar con 9 y tener 9 dígitos.");
    return;
  }

  // 5) Validación de rol
  const rolesValidos = ["agricultor", "agronomo", "tecnico"];
  if (!rolesValidos.includes(rol.toLowerCase())) {
    alert("Rol inválido. Usa 'agricultor', 'agronomo' o 'tecnico'.");
    return;
  }

// 6) Envío al backend
try {
  const res = await fetch("http://localhost:5000/registrar_tecnico", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre, apellidos, email, password, telefono, rol })
  });

  // Leer JSON antes de comprobar el status
  const data = await res.json();

  // 409 Conflict → email duplicado
  if (res.status === 409) {
    alert(`Error: ${data.error}`);
    return;
  }

  // cualquier otro error HTTP
  if (!res.ok) {
    alert(`Error: ${data.error || "Algo salió mal"}`);
    return;
  }

  alert("Usuario registrado correctamente.");
  document.getElementById("formTecnico").reset();

} catch (err) {
  console.error(err);
  alert("Error de conexión con el servidor.");
}
}

// Asocia la función al submit del formulario
document
  .getElementById("formTecnico")
  .addEventListener("submit", e => {
    e.preventDefault();
    registrarUsuario();
  });



function togglePassword() {
  const input = document.getElementById("password");
  const icono = document.getElementById("icono-ojo");

  if (input.type === "password") {
    input.type = "text";
    icono.classList.remove("fa-eye-slash");
    icono.classList.add("fa-eye");
  } else {
    input.type = "password";
    icono.classList.remove("fa-eye");
    icono.classList.add("fa-eye-slash");
  }
}

function togglePasswordMod() {
  const input = document.getElementById("modPassword");
  const icono = document.getElementById("icono-ojo-mod");

  if (input.type === "password") {
    input.type = "text";
    icono.classList.remove("fa-eye-slash");
    icono.classList.add("fa-eye");
  } else {
    input.type = "password";
    icono.classList.remove("fa-eye");
    icono.classList.add("fa-eye-slash");
  }
}

// ------------------ Buscar usuario por email ------------------
async function buscarUsuario() {
  const email = document.getElementById("buscarEmail").value.trim();
  if (!email) {
    alert("Ingresa el email del usuario que deseas buscar.");
    return;
  }

  try {
    const res = await fetch(
      `http://localhost:5000/usuarios/${encodeURIComponent(email)}`
    );
    const data = await res.json();
    
    if (res.ok) {
      document.getElementById("modNombre").value = data.nombre || "";
      document.getElementById("modApellidos").value = data.apellidos || "";
      document.getElementById("modTelefono").value = data.telefono || "";
      document.getElementById("modRol").value = data.rol || "";
      document.getElementById("modPassword").value = ""; 
      document.getElementById("modEmail").value = data.email || "";

    } else {
      alert("Usuario no encontrado.");
    }
  } catch (err) {
    console.error("Error al buscar:", err);
    alert("Error al buscar usuario.");
  }
}

// ------------------ Modificar usuario ------------------
async function modificarUsuario() {
  const email      = document.getElementById("buscarEmail").value.trim();
  const nombre     = document.getElementById("modNombre").value.trim();
  const apellidos  = document.getElementById("modApellidos").value.trim();
  const nuevoEmail = document.getElementById("modEmail").value.trim();
  const password   = document.getElementById("modPassword").value.trim();
  const telefono   = document.getElementById("modTelefono").value.trim();
  const rol        = document.getElementById("modRol").value.trim();

  // 1) Campos obligatorios
  if (!email || !nombre || !apellidos || !nuevoEmail || !telefono || !rol) {
    alert("Por favor completa todos los campos.");
    return;
  }

  // 2) Validación de formato de nuevo email
  const emailRegex = /^[\w.-]+@[\w.-]+\.\w+$/;
  if (!emailRegex.test(nuevoEmail)) {
    alert("Error: Correo inválido. Usa formato usuario@dominio.ext");
    return;
  }

  // 3) Validación de teléfono
  if (!/^\d{9}$/.test(telefono) || !telefono.startsWith("9")) {
    alert("Error: El teléfono debe comenzar con 9 y tener 9 dígitos.");
    return;
  }

  // 4) Validación de rol
  const rolesValidos = ["agricultor", "agronomo", "tecnico"];
  if (!rolesValidos.includes(rol.toLowerCase())) {
    alert("Error: Rol inválido. Usa 'agricultor', 'agronomo' o 'tecnico'.");
    return;
  }

  // 5) Validación de contraseña (solo si se ingresó)
  const payload = { nombre, apellidos, email: nuevoEmail, telefono, rol };
  if (password) {
    if (password.length < 8 || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      alert("Error: La contraseña debe tener al menos 8 caracteres, una mayúscula y un número.");
      return;
    }
    payload.password = password;
  }

  // 6) Llamada al servidor
  try {
    const res = await fetch(
      `http://localhost:5000/actualizar_usuarios/${encodeURIComponent(email)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );

    const data = await res.json();

    if (!res.ok) {
      alert(`Error: ${data.error || data.message || "No se pudo actualizar usuario."}`);
      return;
    }

    alert("Usuario actualizado correctamente.");
    limpiarFormularioModificacion();

  } catch (err) {
    console.error("Error de red:", err);
    alert("Error de conexión con el servidor.");
  }
}


// ------------------ Eliminar usuario ------------------
async function eliminarUsuario() {
  const email = document.getElementById("buscarEmail").value.trim();

  if (!email) {
    alert("Ingresa el correo del usuario que deseas eliminar.");
    return;
  }

  const confirmar = confirm(`¿Estás seguro de que deseas eliminar el usuario con email: ${email}?`);
  if (!confirmar) return;

  try {
    const res = await fetch(
      `http://localhost:5000/eliminar_usuarios/${encodeURIComponent(email)}`,
      { method: "DELETE" }
    );

    const data = await res.json();

    if (res.ok) {
      alert("Usuario eliminado correctamente.");

      limpiarFormularioModificacion();


    } else {
      alert("" + (data.message || data.error || "Error al eliminar usuario."));
    }
  } catch (err) {
    console.error("Error:", err);
    alert("Error de red al eliminar usuario.");
  }
}

function toggleUsuarios() {
  const contenedor = document.getElementById("contenedorUsuarios");
  const visible = contenedor.style.display === "block";
  contenedor.style.display = visible ? "none" : "block";

  if (!visible) {
    cargarUsuarios();
  }
}

async function cargarUsuarios() {
  const lista = document.getElementById("listaUsuarios");
  lista.innerHTML = "Cargando usuarios...";

  try {
    const res = await fetch("http://localhost:5000/obtener_usuarios");
    const data = await res.json();

    if (!Array.isArray(data)) throw new Error("Respuesta inválida");

    if (data.length === 0) {
      lista.innerHTML = "<p>No hay usuarios registrados.</p>";
      return;
    }
    lista.innerHTML = "";
    data.forEach((usuario, index) => {
    const tarjeta = document.createElement("div");
    tarjeta.style.border = "1px solid white";
    tarjeta.style.padding = "20px";
    tarjeta.style.marginBottom = "20px";
    tarjeta.style.borderRadius = "12px";
    tarjeta.style.background = "#3e5c49";
    tarjeta.style.color = "white";
    tarjeta.style.fontFamily = "IBM Plex Mono";
    tarjeta.style.fontSize = "16px";

    tarjeta.innerHTML = `
        <strong style="font-size: 18px;">👤 ${usuario.nombre} ${usuario.apellidos}</strong><br>
        <b>Email:</b> ${usuario.email}<br>
        <b>Teléfono:</b> ${usuario.telefono}<br>
        <b>Rol:</b> ${usuario.rol}
    `;

    lista.appendChild(tarjeta);
    });


  } catch (err) {
    console.error(err);
    lista.innerHTML = "Error al cargar usuarios.";
  }
}

function limpiarFormularioRegistro() {
  ["nombre", "apellidos", "email", "password", "telefono", "rol"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}

function limpiarFormularioModificacion() {
  ["buscarEmail", "modNombre", "modApellidos", "modEmail", "modPassword", "modTelefono", "modRol"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}
