//------------------------------------------------------
// NAV.JS
// Sidebar navigation - click-to-show sections (only one
// center-content view is visible at a time, accordion
// style) - and the Settings panel (base map + route
// distance unit).
//------------------------------------------------------

//======================================================
// SWITCH VIEW - show the target .view-panel, hide the rest
//======================================================

let mapShownOnce = false;

function switchView(targetId){

    const panels = document.querySelectorAll(".view-panel");

    panels.forEach(panel => {

        if(panel.id === targetId){

            panel.style.display = panel.dataset.display || "block";

        }

        else{

            panel.style.display = "none";

        }

    });

    //----------------------------------------------------
    // The Leaflet map can't size itself correctly while its
    // container was display:none, so nudge it once it's
    // actually visible again.
    //----------------------------------------------------

    if(targetId === "mapSection" && window.map){

        // A single guessed delay isn't reliable - the container's
        // layout needs to actually finish before Leaflet can measure
        // it correctly. Double rAF waits for two real paint cycles;
        // the timeout is just a safety net behind that.

        requestAnimationFrame(() => {

            requestAnimationFrame(() => {

                window.map.invalidateSize();

                //--------------------------------------------
                // The very first time the map tab is opened,
                // it was fitBounds()'d while still hidden
                // (0x0 container), which Leaflet can't measure
                // correctly and leaves it oddly zoomed in. Now
                // that the container has a real size, show a
                // clear, zoomed-out view of the whole
                // plantation instead of whatever that produced.
                //--------------------------------------------

                if(!mapShownOnce){

                    mapShownOnce = true;

                    if(typeof window.homeMap === "function"){

                        window.homeMap();

                    }

                }

            });

        });

        setTimeout(() => window.map.invalidateSize(), 300);

    }

    if(targetId === "ndviSection" && window.NdviState?.map){

        requestAnimationFrame(() => {

            requestAnimationFrame(() => {

                window.NdviState.map.invalidateSize();

            });

        });

        setTimeout(() => window.NdviState.map.invalidateSize(), 300);

    }

    document.getElementById("dashboardSection")
        ?.scrollTo({ top:0, behavior:"smooth" });

}

window.switchView = switchView;

//======================================================
// ACTIVATE NAV LINK - highlight the sidebar link that
// matches a given view id (used when other scripts, like
// search, switch the view programmatically).
//======================================================

function activateNavLink(targetId){

    document.querySelectorAll("#sidebarNav a").forEach(a => {

        a.classList.toggle("active", a.dataset.target === targetId);

    });

}

window.activateNavLink = activateNavLink;

//======================================================
// GO TO MAP VIEW - convenience used by parcel/grower
// search so results are actually visible on screen.
//======================================================

function goToMapView(){

    switchView("mapSection");

    activateNavLink("mapSection");

}

window.goToMapView = goToMapView;

document.addEventListener("DOMContentLoaded", () => {

    document.querySelectorAll("#sidebarNav a").forEach(link => {

        link.addEventListener("click", (e) => {

            e.preventDefault();

            const action = link.dataset.action;

            //----------------------------------------------
            // Action-style links (Reports / Downloads)
            //----------------------------------------------

            if(action === "reportBtn"){

                if(typeof generateReport === "function") generateReport();

                return;

            }

            if(action === "downloadBtn"){

                if(typeof downloadData === "function") downloadData();

                return;

            }

            //----------------------------------------------
            // Section links
            //----------------------------------------------

            const targetId = link.dataset.target;

            const target = document.getElementById(targetId);

            if(!target) return;

            document.querySelectorAll("#sidebarNav a")
                .forEach(a => a.classList.remove("active"));

            link.classList.add("active");

            //------------------------------------------
            // Toggleable center-content views (Dashboard,
            // Map, Register, Growers, Production, Harvest,
            // Settings) - show only the clicked one.
            //------------------------------------------

            if(target.classList.contains("view-panel")){

                switchView(targetId);

                return;

            }

            //------------------------------------------
            // Everything else (e.g. the persistent
            // Analytics sidebar) just scrolls into view.
            //------------------------------------------

            target.scrollIntoView({

                behavior:"smooth",

                block:"start"

            });

        });

    });

    //====================================================
    // SETTINGS - DEFAULT BASE MAP
    //====================================================

    document.getElementById("settingDefaultLayer")
        ?.addEventListener("change", (e) => {

            if(typeof map === "undefined" || !map) return;

            const wantSatellite = e.target.value === "satellite";

            if(wantSatellite && map.hasLayer(streetLayer)){

                toggleBaseMap();

            }

            else if(!wantSatellite && map.hasLayer(satelliteLayer)){

                toggleBaseMap();

            }

        });

    //====================================================
    // SETTINGS - ROUTE DISTANCE UNIT
    //====================================================

    document.getElementById("settingDistanceUnit")
        ?.addEventListener("change", (e) => {

            window.distanceUnit = e.target.value;

        });

});
