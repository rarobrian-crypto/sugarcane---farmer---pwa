//------------------------------------------------------
// GROWER MODAL
//------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {

    const growerModal = document.getElementById("growerModal");

    const addGrowerBtn = document.getElementById("addGrowerBtn");

    const closeGrower = document.querySelector(".closeGrower");

    const cancelGrower = document.getElementById("cancelGrowerBtn");

    if(!growerModal) return;

    //--------------------------------------------------
    // OPEN
    //--------------------------------------------------

    addGrowerBtn?.addEventListener("click", () => {

        growerModal.style.display = "block";

    });

    //--------------------------------------------------
    // CLOSE X
    //--------------------------------------------------

    closeGrower?.addEventListener("click", () => {

        growerModal.style.display = "none";

        window.wizardAwaitingGrower = false;

    });

    //--------------------------------------------------
    // CANCEL
    //--------------------------------------------------

    cancelGrower?.addEventListener("click", () => {

        growerModal.style.display = "none";

        window.wizardAwaitingGrower = false;

    });

    //--------------------------------------------------
    // CLICK OUTSIDE
    //--------------------------------------------------

    window.addEventListener("click", (e) => {

        if(e.target === growerModal){

            growerModal.style.display = "none";

        }

    });

});
