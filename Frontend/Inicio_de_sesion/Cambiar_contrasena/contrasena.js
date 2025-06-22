function togglePassword(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);

    if (input.type === "password") {
    input.type = "text";
    icon.classList.remove("fa-eye-slash");
    icon.classList.add("fa-eye");
    } else {
    input.type = "password";
    icon.classList.remove("fa-eye");
    icon.classList.add("fa-eye-slash");
    }
}

function cambiarContrasena() {
    const email = document.getElementById("email").value;
    const nueva = document.getElementById("nuevaContrasena").value;
    const confirmar = document.getElementById("confirmarContrasena").value;
    const clave = document.getElementById("clave").value;
    if (clave.length !== 6) {
    alert("La clave de verificación debe tener 6 dígitos.");
    return;
    }


    if (!email || !nueva || !confirmar) {
    alert("Completa todos los campos.");
    return;
    }

    if (nueva !== confirmar) {
    alert("Las contraseñas no coinciden.");
    return;
    }

    fetch("http://localhost:5000/cambiar-contrasena", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, nuevaContrasena: nueva, clave })

    })
    .then(res => res.json())
    .then(data => {
    alert(data.message);
    if (data.success) {
        window.location.href = "/Frontend/Inicio_de_sesion/Iniciar_sesion/sesion.html";
    }
    })
    .catch(err => {
    alert("Error al conectar con el servidor.");
    console.error(err);
    });
}

function enviarClave() {
    const email = document.getElementById("email").value;
    const boton = event.target;
    
    if (!email) {
    alert("Por favor ingresa tu correo.");
    return;
    }

    boton.disabled = true;
    boton.innerText = "Enviando...";

    fetch("http://localhost:5000/enviar-clave-verificacion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
    })
    .then(res => res.json())
    .then(data => {
    alert(data.message);
    boton.innerText = "Clave enviada ✓";
    })
    .catch(err => {
    alert("Error al enviar la clave.");
    console.error(err);
    boton.disabled = false;
    boton.innerText = "Enviar clave temporal";
    });
}


