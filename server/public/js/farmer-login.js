//------------------------------------------------------
// FARMER-LOGIN.JS
// Accessible in-page setup for a farmer's PWA login.
// The password is entered by staff and is never echoed back.
//------------------------------------------------------

function wireCreateFarmerLoginButtons(){
    document.querySelectorAll(".create-farmer-login-btn").forEach((btn) => {
        if (btn.dataset.wired) return;
        btn.dataset.wired = "1";
        btn.addEventListener("click", () => openCreateFarmerLoginPrompt(
            btn.dataset.growerId,
            btn.dataset.growerName,
            btn.dataset.growerPhone
        ));
    });
}

function escapeLoginHtml(value){
    return String(value || "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
}

function openCreateFarmerLoginPrompt(growerId, growerName, growerPhone){
    document.getElementById("farmerLoginSetup")?.remove();
    const modal = document.createElement("div");
    modal.id = "farmerLoginSetup";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "farmerLoginSetupTitle");
    modal.style.cssText = "position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.58);display:grid;place-items:center;padding:20px;";
    modal.innerHTML = `
      <section style="width:min(100%,440px);background:#fff;border-radius:18px;padding:24px;box-shadow:0 24px 72px rgba(0,0,0,.28);font-family:inherit;color:#183326;">
        <h2 id="farmerLoginSetupTitle" style="margin:0 0 8px;">Create farmer app login</h2>
        <p style="margin:0 0 18px;color:#52635a;">For <strong>${escapeLoginHtml(growerName)}</strong>. The password you set is stored as a secure hash.</p>
        <form id="farmerLoginSetupForm">
          <label for="farmerLoginPhone" style="display:block;margin:12px 0 6px;font-weight:600;">Phone number</label>
          <input id="farmerLoginPhone" name="phone" type="tel" autocomplete="tel" required value="${escapeLoginHtml(growerPhone)}" style="width:100%;box-sizing:border-box;padding:12px;border:1px solid #cbd5ce;border-radius:10px;font:inherit;">
          <label for="farmerLoginPassword" style="display:block;margin:14px 0 6px;font-weight:600;">Temporary password</label>
          <input id="farmerLoginPassword" name="password" type="password" autocomplete="new-password" required minlength="8" style="width:100%;box-sizing:border-box;padding:12px;border:1px solid #cbd5ce;border-radius:10px;font:inherit;">
          <p id="farmerLoginSetupMessage" role="status" style="min-height:1.3em;margin:10px 0;color:#9a3412;"></p>
          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px;">
            <button type="button" id="farmerLoginCancel" class="btn-secondary">Cancel</button>
            <button type="submit" id="farmerLoginSubmit" class="btn-primary">Create login</button>
          </div>
        </form>
      </section>`;
    document.body.appendChild(modal);
    const form = modal.querySelector("#farmerLoginSetupForm");
    const phoneInput = modal.querySelector("#farmerLoginPhone");
    const passwordInput = modal.querySelector("#farmerLoginPassword");
    const message = modal.querySelector("#farmerLoginSetupMessage");
    const submit = modal.querySelector("#farmerLoginSubmit");
    modal.querySelector("#farmerLoginCancel").addEventListener("click", () => modal.remove());
    modal.addEventListener("click", (event) => { if (event.target === modal) modal.remove(); });
    passwordInput.focus();

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const phone = phoneInput.value.trim();
        const password = passwordInput.value;
        if (!phone || password.length < 8) {
            message.textContent = "Enter a phone number and a password of at least 8 characters.";
            return;
        }
        submit.disabled = true;
        message.style.color = "#52635a";
        message.textContent = "Creating login…";
        try {
            const res = await fetch("/farmer/register", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ grower_id: growerId, name: growerName, phone, password })
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || "Could not create this login.");
            passwordInput.value = "";
            form.innerHTML = `
              <p role="status" style="color:#166534;margin:18px 0;">Login created for ${escapeLoginHtml(growerName)}.</p>
              <p style="color:#52635a;">Sign in at <a href="/farmer/login.html">the farmer app login page</a> using the phone above and the password you set.</p>
              <div style="display:flex;justify-content:flex-end;margin-top:20px;"><button type="button" id="farmerLoginDone" class="btn-primary">Done</button></div>`;
            form.querySelector("#farmerLoginDone").addEventListener("click", () => {
                modal.remove();
                const button = document.querySelector(`.create-farmer-login-btn[data-grower-id="${CSS.escape(String(growerId))}"]`);
                if (button) button.textContent = "Login created";
            });
        } catch (error) {
            message.style.color = "#b91c1c";
            message.textContent = error.message || "Could not reach the server. Check your connection and try again.";
            submit.disabled = false;
            passwordInput.value = "";
            passwordInput.focus();
        }
    });
}

window.wireCreateFarmerLoginButtons = wireCreateFarmerLoginButtons;
