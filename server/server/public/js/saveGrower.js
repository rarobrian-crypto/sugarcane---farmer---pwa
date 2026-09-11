//------------------------------------------------------
// SAVE GROWER
//------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {

    const saveBtn = document.getElementById("saveGrowerBtn");

    saveBtn.addEventListener("click", saveGrower);

});

async function saveGrower(){

    const growerName = document.getElementById("growerName").value.trim();

    const phone = document.getElementById("growerPhone").value.trim();

    const village = document.getElementById("growerVillage").value.trim();

    if(!growerName){

        alert("Please enter grower name.");

        return;

    }

    try{

        const response = await fetch("/growers",{

            method:"POST",

            headers:{

                "Content-Type":"application/json"

            },

            body:JSON.stringify({

                grower_name:growerName,

                phone:phone,

                village:village

            })

        });

        if (!response.ok) {

    const errorText = await response.text();

    console.error("SERVER RESPONSE:");
    console.error(errorText);

    alert("Server returned " + response.status);

    return;

}

const grower = await response.json();

        //--------------------------------------------------
        // Reload growers from PostgreSQL
        //--------------------------------------------------

        await loadGrowers();

        //--------------------------------------------------
        // Select new grower automatically
        //--------------------------------------------------

        populateGrowerDropdown(grower.grower_id);

        if(typeof logActivity === "function"){

            logActivity(`New grower added: ${grower.grower_name}`);

        }

        if(window.wizardAwaitingGrower && typeof ParcelWizard !== "undefined"){

            populateGrowerDropdown(grower.grower_id, "wzGrowerSelect");

            ParcelWizard.data.grower_id = String(grower.grower_id);

            window.wizardAwaitingGrower = false;

        }

        //--------------------------------------------------
        // Close grower modal
        //--------------------------------------------------

        document.getElementById("growerModal").style.display="none";

        //--------------------------------------------------
        // Clear fields
        //--------------------------------------------------

        document.getElementById("growerName").value="";

        document.getElementById("growerPhone").value="";

        document.getElementById("growerVillage").value="";

    }

    catch(error){

        console.error(error);

        alert("Unable to save grower.");

    }

}