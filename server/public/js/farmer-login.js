//------------------------------------------------------
// FARMER-LOGIN.JS
// "Create Login" button on the Growers Directory table —
// creates a login for the farmer PWA (/farmer/login.html),
// tied to that grower. Requires manage_growers permission
// (enforced server-side by /farmer/register, not just here).
//------------------------------------------------------

function wireCreateFarmerLoginButtons(){

    document.querySelectorAll(".create-farmer-login-btn").forEach(btn => {

        // Avoid double-binding when the table re-renders.
        if(btn.dataset.wired) return;
        btn.dataset.wired = "1";

        btn.addEventListener("click", () => openCreateFarmerLoginPrompt(
            btn.dataset.growerId,
            btn.dataset.growerName,
            btn.dataset.growerPhone
        ));

    });

}

async function openCreateFarmerLoginPrompt(growerId, growerName, growerPhone){

    const phone = prompt(
        `Phone number this farmer will log in with (for ${growerName}):`,
        growerPhone || ""
    );

    if(!phone) return;

    const password = prompt(
        `Temporary password for ${growerName} (share this with them directly — they aren't shown it again):`
    );

    if(!password) return;

    try{

        const res = await fetch("/farmer/register", {

            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                grower_id: growerId,
                name: growerName,
                phone,
                password
            })

        });

        const data = await res.json();

        if(data.success){
            alert(`Farmer app login created for ${growerName}.\n\nPhone: ${phone}\nPassword: ${password}\n\nShare these with the farmer — they can sign in at /farmer/login.html.`);
        } else {
            alert(data.error || "Couldn't create the login.");
        }

    }
    catch(err){

        alert("Couldn't reach the server — check your connection and try again.");

    }

}

window.wireCreateFarmerLoginButtons = wireCreateFarmerLoginButtons;
