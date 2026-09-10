//------------------------------------------------------
// AUTH.JS (dashboard side)
//------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {

    //====================================================
    // LOAD SESSION INFO INTO HEADER
    // (permissions.js does the actual fetch - we just
    // listen for it so there's one request, not two)
    //====================================================

    document.addEventListener("permissionsLoaded", (e) => {

        const session = e.detail;

        document.getElementById("userDepartmentLabel").textContent =
            session.department || "Administrator";

        document.getElementById("userNameLabel").textContent =
            session.username || "-";

    });

    //====================================================
    // USER DROPDOWN TOGGLE
    //====================================================

    const toggle = document.getElementById("userMenuToggle");

    const dropdown = document.getElementById("userDropdown");

    toggle?.addEventListener("click", (e) => {

        e.stopPropagation();

        dropdown.classList.toggle("open");

    });

    document.addEventListener("click", () => {

        dropdown?.classList.remove("open");

    });

    //====================================================
    // LOGOUT
    //====================================================

    document.getElementById("logoutBtn")
        ?.addEventListener("click", async (e) => {

            e.stopPropagation();

            try{

                await fetch("/logout", { method:"POST" });

            }
            catch(err){

                console.error(err);

            }

            window.location.href = "/login.html";

        });

});
