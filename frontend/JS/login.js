document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    const errorMsg = document.getElementById('errorMsg');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const username = document.getElementById('username').value.trim();
            const pass = document.getElementById('password').value.trim();

            const btn = document.querySelector('.btn-login');
            btn.textContent = 'Ingresando...';
            btn.style.opacity = '0.8';
            errorMsg.style.display = 'none';

            try {
                // We send only the username as 'nombre_completo' to match schemas
                const response = await fetch('/api/staff/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        nombre_completo: username,
                        rol: "admin" // Placeholder as it's required by schema but handled by backend
                    })
                });

                const data = await response.json();

                if (response.ok && data.token) {
                    // Success
                    localStorage.setItem('usuarioLogueado', 'true');
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));

                    // Role-based redirection
                    if (data.user.rol === 'especialista') {
                        window.location.href = '/cabina.html';
                    } else {
                        window.location.href = '/dashboard';
                    }
                } else {
                    // Fail
                    throw new Error(data.error || 'Credenciales incorrectas');
                }
            } catch (err) {
                console.error("Login Error:", err);
                errorMsg.style.display = 'flex';
                btn.textContent = 'Ingresar';
                btn.style.opacity = '1';
                
                // Shake animation
                const card = document.querySelector('.login-card');
                card.style.animation = 'none';
                void card.offsetWidth; /* trigger reflow */
                card.style.animation = 'shake 0.4s';
            }
        });
    }
});
