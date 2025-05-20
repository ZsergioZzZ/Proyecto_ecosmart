      async function login() {
        const email = document.getElementById("email").value;
        const password = document.getElementById("contrasena").value;
    
        try {
          const response = await fetch("http://localhost:5000/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
    
          const data = await response.json();
          
    
          if (!data.success) {
            alert(data.message);
            return;
          }
    
          const rol = data.rol;
          localStorage.setItem("nombreUsuario", data.nombre);

    
          if (rol === "tecnico") {
            alert("Está ingresando como técnico. Le hemos enviado un correo con una clave de verificación (Revisar SPAM).");
    
            const clave = prompt("Por favor, ingrese la clave enviada al correo:");
            if (!clave) return;
    
            const validacion = await fetch("http://localhost:5000/verificar-clave", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, clave }),
            });
    
            const resultado = await validacion.json();
            if (!resultado.success) {
              alert("Clave incorrecta. Acceso denegado.");
              return;
            }
    
            window.location.href = "/Frontend/Tecnico/Inicio/inicio_tecnico.html";
    
          } else if (rol === "agronomo") {
            window.location.href = "/Frontend/Agronomo/Inicio/inicio_agronomo.html";
          } else if (rol === "agricultor") {
            window.location.href = "/Frontend/Agricultor/Inicio/inicio_agricultor.html";
          } else {
            alert("Rol no reconocido");
          }
    
        } catch (err) {
          alert("Error en el servidor: " + err);
        }
      }

       // Función para alternar la visibilidad de la contraseña
      function togglePassword() {
      const input = document.getElementById("contrasena");
      const icon = document.getElementById("icono-ojo");

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