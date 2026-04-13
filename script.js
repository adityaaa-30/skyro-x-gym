document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");

    if (!loginForm) {
        return;
    }

    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const loginBtn = document.querySelector(".login-btn");

    ["email", "password"].forEach((id) => {
        const input = document.getElementById(id);
        const parent = input.parentNode;

        if (!document.getElementById(`${id}Error`)) {
            const errorSpan = document.createElement("span");
            errorSpan.id = `${id}Error`;
            errorSpan.className = "error-message";
            errorSpan.style.cssText = "color: #e74c3c; font-size: 0.85rem; margin-top: 5px; display: none;";
            parent.appendChild(errorSpan);
        }
    });

    const emailError = document.getElementById("emailError");
    const passwordError = document.getElementById("passwordError");

    [emailInput, passwordInput].forEach((input) => {
        input.addEventListener("focus", function () {
            this.parentNode.style.border = "2px solid #1273ff";
        });

        input.addEventListener("blur", function () {
            if (!this.value.trim()) {
                this.parentNode.style.border = "2px solid rgba(255, 255, 255, 0.08)";
            }
        });
    });

    function showError(el, msg) {
        el.textContent = msg;
        el.style.display = "block";
    }

    function clearError(el) {
        el.textContent = "";
        el.style.display = "none";
    }

    function validateEmail() {
        const email = emailInput.value.trim();
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!email) {
            showError(emailError, "Email is required");
            return false;
        }

        if (!regex.test(email)) {
            showError(emailError, "Enter valid email");
            return false;
        }

        clearError(emailError);
        return true;
    }

    function validatePassword() {
        const password = passwordInput.value;

        if (!password) {
            showError(passwordError, "Password required");
            return false;
        }

        if (password.length < 6) {
            showError(passwordError, "Minimum 6 characters");
            return false;
        }

        clearError(passwordError);
        return true;
    }

    async function handleLogin() {
        loginBtn.innerHTML = "Logging...";
        loginBtn.disabled = true;

        try {
            const res = await fetch("http://localhost:5000/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: emailInput.value.trim(),
                    password: passwordInput.value
                })
            });

            const data = await res.json();

            if (!res.ok) {
                alert(data.message || "Login failed.");
                return;
            }

            localStorage.setItem("userEmail", data.user.email);
            localStorage.setItem("userName", data.user.name);
            localStorage.setItem("userRole", data.user.role);
            localStorage.setItem("isAdmitted", String(data.user.isAdmitted));

            alert(data.message);

            if (data.user.role === "admin") {
                window.location.href = "admin.html";
                return;
            }

            window.location.href = "index.html";
        } catch (error) {
            console.error(error);
            alert("Server error");
        } finally {
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
        }
    }

    loginForm.addEventListener("submit", (e) => {
        e.preventDefault();

        if (validateEmail() && validatePassword()) {
            handleLogin();
        }
    });
});
