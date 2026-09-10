//------------------------------------------------------
// PERMISSIONS.JS
//
// Applies department-based access control to the UI.
// This is convenience/UX - the actual security boundary
// is server-side (requirePermission in server.js). Every
// write action and route-analysis call is re-checked
// there regardless of what this file does to the DOM.
//------------------------------------------------------

// elementId -> permission required to use it (buttons)
const BUTTON_PERMISSIONS = {

    addParcelBtn:      "manage_parcels",
    uploadBtn:          "manage_parcels",
    addGrowerBtn:       "manage_growers",
    growersAddBtn:      "manage_growers",
    growersExportBtn:   "view_growers",
    downloadBtn:        "download_data",
    coordPickerBtn:     "route_analysis",
    ndviAddCard:        "manage_ndvi"

};

// nav data-target -> permission required to view it
const NAV_PERMISSIONS = {

    dashboardSection:  "view_dashboard",
    mapSection:         "view_map",
    registerSection:    "view_parcels",
    growersSection:     "view_growers",
    productionSection:  "view_production",
    harvestSection:     "view_harvest",
    ndviSection:        "view_ndvi",
    analyticsSection:   "view_analytics",
    reportsSection:     "generate_reports",
    settingsSection:    "manage_settings"

};

window.currentUser = null;

async function loadPermissions(){

    try{

        const response = await fetch("/session");

        if(!response.ok){

            window.location.href = "/login.html";

            return;

        }

        const session = await response.json();

        window.currentUser = session;

        applyPermissionsToUI(session.permissions || []);

        document.dispatchEvent(new CustomEvent("permissionsLoaded", {

            detail:session

        }));

    }
    catch(err){

        console.error("Failed to load session/permissions:", err);

    }

}

function hasPermission(permission){

    if(!window.currentUser) return false;

    return (window.currentUser.permissions || []).includes(permission);

}

function applyPermissionsToUI(permissions){

    //----------------------------------------------------
    // Sidebar nav - lock (don't hide) restricted sections,
    // so the department can see what exists but can't open
    // it, with a clear reason on click.
    //----------------------------------------------------

    document.querySelectorAll("#sidebarNav a[data-target]").forEach(link => {

        const target = link.dataset.target;

        const required = NAV_PERMISSIONS[target];

        if(!required) return; // no restriction defined - leave open

        if(!permissions.includes(required)){

            link.classList.add("nav-locked");

            link.title = "Restricted - not available to your department";

            const lockIcon = document.createElement("i");

            lockIcon.className = "fa-solid fa-lock nav-lock-icon";

            link.appendChild(lockIcon);

        }

    });

    //----------------------------------------------------
    // Action buttons - hide entirely if not permitted
    //----------------------------------------------------

    Object.entries(BUTTON_PERMISSIONS).forEach(([id, permission]) => {

        if(!permissions.includes(permission)){

            document.getElementById(id)?.remove();

        }

    });

    //----------------------------------------------------
    // Edit/Delete icons in every table row - hide if the
    // department can't manage parcels. View stays.
    //----------------------------------------------------

    if(!permissions.includes("manage_parcels")){

        document.body.classList.add("no-manage-parcels");

    }

    if(!permissions.includes("manage_growers")){

        document.body.classList.add("no-manage-growers");

    }

    if(!permissions.includes("route_analysis")){

        document.body.classList.add("no-route-analysis");

    }

}

//======================================================
// INTERCEPT CLICKS ON LOCKED NAV LINKS
//======================================================

document.addEventListener("click", (e) => {

    const link = e.target.closest("#sidebarNav a.nav-locked");

    if(!link) return;

    e.preventDefault();

    e.stopImmediatePropagation();

    const deptLabel = window.currentUser?.department || "your department";

    showAccessDeniedToast(

        `This section isn't available to ${deptLabel}. Contact a System Administrator if you need access.`

    );

}, true);

function showAccessDeniedToast(message){

    let toast = document.getElementById("accessDeniedToast");

    if(!toast){

        toast = document.createElement("div");

        toast.id = "accessDeniedToast";

        document.body.appendChild(toast);

    }

    toast.innerHTML = `<i class="fa-solid fa-lock"></i> ${message}`;

    toast.classList.add("show");

    clearTimeout(window._toastTimer);

    window._toastTimer = setTimeout(() => {

        toast.classList.remove("show");

    }, 3500);

}

window.hasPermission = hasPermission;
window.showAccessDeniedToast = showAccessDeniedToast;

document.addEventListener("DOMContentLoaded", loadPermissions);
