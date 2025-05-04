# validaciones.py
def validar_email(email):
    return '@' in email and '.' in email.split('@')[-1]

def validar_telefono(telefono):
    return telefono.isdigit() and len(telefono) == 9 and telefono.startswith("9")

def validar_rol(rol):
    return rol.lower() in {"agricultor", "agronomo", "tecnico"}

def validar_password(password):
    return (
        len(password) >= 8 and
        any(c.isdigit() for c in password) and
        any(c.isupper() for c in password)
    )