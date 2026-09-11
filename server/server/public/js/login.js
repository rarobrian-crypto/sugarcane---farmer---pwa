//------------------------------------------------------
// LOGIN.JS
//------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {

    //====================================================
    // DEPARTMENT CARD SELECTION
    //====================================================

    const deptSelect = document.getElementById("loginDepartment");

    document.querySelectorAll(".dept-card").forEach(card => {

        card.addEventListener("click", () => {

            document.querySelectorAll(".dept-card")
                .forEach(c => c.classList.remove("selected"));

            card.classList.add("selected");

            deptSelect.value = card.dataset.department;

            document.getElementById("loginUsername").focus();

        });

    });

    //====================================================
    // SHOW / HIDE PASSWORD
    //====================================================

    const passwordInput = document.getElementById("loginPassword");

    document.getElementById("togglePassword")
        .addEventListener("click", (e) => {

            e.preventDefault();

            const showing = passwordInput.type === "text";

            passwordInput.type = showing ? "password" : "text";

            e.currentTarget.innerHTML = showing
                ? '<i class="fa-solid fa-eye"></i>'
                : '<i class="fa-solid fa-eye-slash"></i>';

        });

    //====================================================
    // SUBMIT LOGIN
    //====================================================

    document.getElementById("loginForm")
        .addEventListener("submit", async (e) => {

            e.preventDefault();

            const errorBox = document.getElementById("loginError");

            const btn = document.getElementById("signInBtn");

            errorBox.textContent = "";

            const username = document.getElementById("loginUsername").value.trim();

            const password = passwordInput.value;

            if(!username || !password){

                errorBox.textContent = "Please enter your username and password.";

                return;

            }

            btn.disabled = true;

            btn.textContent = "Signing in...";

            try{

                const response = await fetch("/login", {

                    method:"POST",

                    headers:{ "Content-Type":"application/json" },

                    body:JSON.stringify({ username, password })

                });

                const result = await response.json();

                if(!result.success){

                    errorBox.textContent = result.error || "Invalid username or password.";

                    btn.disabled = false;

                    btn.textContent = "Sign In";

                    return;

                }

                window.location.href = "/index.html";

            }
            catch(err){

                console.error(err);

                errorBox.textContent = "Unable to reach the server. Please try again.";

                btn.disabled = false;

                btn.textContent = "Sign In";

            }

        });

    //====================================================
    // SSO (not implemented - demo-scale app has no
    // identity provider configured)
    //====================================================

    document.querySelector(".sso-btn")
        .addEventListener("click", () => {

            alert("Single Sign-On isn't configured for this deployment yet - use department credentials to sign in.");

        });

});
