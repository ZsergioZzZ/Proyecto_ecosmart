async function registrarUsuario() {
  const nombre = document.getElementById("nombre").value.trim();
  const apellidos = document.getElementById("apellidos").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const telefono = document.getElementById("telefono").value.trim();
  const rol = document.getElementById("rol").value;

  if (!nombre || !apellidos || !email || !password || !telefono || !rol) {
    alert("Por favor completa todos los campos.");
    return;
  }

  if (password.length < 8 || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    alert("La contraseña debe tener al menos 8 caracteres, una mayúscula y un número.");
    return;
  }

  if (!/^\d{9}$/.test(telefono) || !telefono.startsWith("9")) {
    alert("El teléfono debe comenzar con 9 y tener 9 dígitos.");
    return;
  }


  try {
    const res = await fetch("http://localhost:5050/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre,
        apellidos,
        email,
        password,
        telefono,
        rol
      })
    });

    const data = await res.json();
    if (res.ok) {
      alert("Usuario registrado correctamente.");
      limpiarFormularioRegistro();
    } else {
      alert("" + (data.message || data.error || "Error al registrar usuario."));
    }
  } catch (err) {
    console.error("Error:", err);
    alert("Error de red al registrar usuario.");
  }
}

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
    const res = await fetch(`http://localhost:5050/usuarios/${encodeURIComponent(email)}`);
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
  const email = document.getElementById("buscarEmail").value.trim();  
  const nombre = document.getElementById("modNombre").value.trim();
  const apellidos = document.getElementById("modApellidos").value.trim();
  const nuevoEmail = document.getElementById("modEmail").value.trim();
  const password = document.getElementById("modPassword").value.trim();
  const telefono = document.getElementById("modTelefono").value.trim();
  const rol = document.getElementById("modRol").value;


  if (!email || !nombre || !apellidos || !nuevoEmail || !telefono || !rol) {
    alert("Completa todos los campos.");
    return;
  }

  if (!/^[\w.-]+@[\w.-]+\.\w+$/.test(nuevoEmail)) {
    alert("Correo nuevo inválido.");
    return;
  }

  const payload = { nombre, apellidos, email: nuevoEmail, telefono, rol };

  if (password) {
    if (password.length < 8 || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      alert("La contraseña debe tener al menos 8 caracteres, una mayúscula y un número.");
      return;
    }
    payload.password = password;
  }

  try {
    const res = await fetch(`http://localhost:5050/usuarios/${encodeURIComponent(email)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.ok) {
      alert("Usuario actualizado correctamente.");
      limpiarFormularioModificacion();

    } else {
      alert("" + (data.message || data.error || "Error al actualizar usuario."));
    }
  } catch (err) {
    console.error("Error:", err);
    alert("Error de red al modificar usuario.");
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
    const res = await fetch(`http://localhost:5050/usuarios/${encodeURIComponent(email)}`, {
      method: "DELETE"
    });

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
    const res = await fetch("http://localhost:5050/usuarios");
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
