//------------------------------------------------------
// EXPORT-UTILS.JS
// Shared CSV / Excel / print helpers used by the header
// action buttons on every table page (Register, Growers,
// Production, Harvest) and the Reports & Exports page.
//------------------------------------------------------

//======================================================
// CSV EXPORT
//======================================================

function exportRowsAsCSV(filename, headers, rows){

    if(!rows || !rows.length){

        alert("There's no data to export yet.");

        return;

    }

    const escapeCell = v =>
        `"${String(v === null || v === undefined ? "" : v).replace(/"/g, '""')}"`;

    const csv = [

        headers.map(escapeCell).join(","),

        ...rows.map(row => row.map(escapeCell).join(","))

    ].join("\n");

    const blob = new Blob([csv], { type:"text/csv" });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;

    a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;

    a.click();

    URL.revokeObjectURL(url);

}

//======================================================
// EXCEL (.xlsx) EXPORT - via SheetJS
//======================================================

function exportRowsAsXLSX(filename, sheetName, headers, rows){

    if(!rows || !rows.length){

        alert("There's no data to export yet.");

        return;

    }

    if(typeof XLSX === "undefined"){

        // Fall back gracefully if the CDN script didn't load
        // (e.g. offline) instead of silently doing nothing.

        exportRowsAsCSV(filename, headers, rows);

        return;

    }

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName || "Sheet1");

    XLSX.writeFile(

        workbook,

        filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`

    );

}

//======================================================
// TABLE -> ROWS
// Reads whatever is currently rendered in a <table>'s
// <thead>/<tbody> so exports always match what's on screen
// (respects the active Quick Filters).
//======================================================

function tableToRows(tableEl){

    if(!tableEl) return { headers:[], rows:[] };

    const headerCells = Array.from(

        tableEl.querySelectorAll("thead th")

    ).map(th => th.textContent.trim()).filter(Boolean);

    const rows = Array.from(

        tableEl.querySelectorAll("tbody tr")

    ).map(tr =>

        Array.from(tr.children)

            .slice(0, headerCells.length)

            .map(td => td.textContent.trim())

    ).filter(row => row.length && row.some(cell => cell !== ""));

    return { headers:headerCells, rows };

}

//======================================================
// EXPORT A RENDERED TABLE DIRECTLY
//======================================================

function exportTableAsCSV(tableId, filename){

    const { headers, rows } = tableToRows(document.getElementById(tableId));

    exportRowsAsCSV(filename, headers, rows);

}

function exportTableAsXLSX(tableId, filename, sheetName){

    const { headers, rows } = tableToRows(document.getElementById(tableId));

    exportRowsAsXLSX(filename, sheetName, headers, rows);

}

//======================================================
// PRINT THE CURRENTLY VISIBLE PAGE (used as the "PDF"
// action - the browser's own Print dialog offers
// "Save as PDF", which is the most reliable, dependency
// -free way to produce a real PDF client-side)
//======================================================

function printCurrentView(){

    window.print();

}

window.exportRowsAsCSV = exportRowsAsCSV;

window.exportRowsAsXLSX = exportRowsAsXLSX;

window.exportTableAsCSV = exportTableAsCSV;

window.exportTableAsXLSX = exportTableAsXLSX;

window.printCurrentView = printCurrentView;

//======================================================
// REPORTS & EXPORTS PAGE
//======================================================

const REPORT_TABLE_MAP = {

    parcels:{ tableId:"parcelTable", filename:"parcel_summary_report", sheet:"Parcels" },

    production:{ tableId:"productionTable", filename:"production_report", sheet:"Production" },

    variety:{ tableId:"productionTable", filename:"variety_report", sheet:"Variety" },

    harvest:{ tableId:"harvestTable", filename:"harvest_report", sheet:"Harvest" },

    growers:{ tableId:"growersTable", filename:"grower_report", sheet:"Growers" }

};

document.addEventListener("DOMContentLoaded", () => {

    document.querySelectorAll("[data-report]").forEach(btn => {

        btn.addEventListener("click", () => {

            const config = REPORT_TABLE_MAP[btn.dataset.report];

            if(!config) return;

            if(btn.dataset.format === "xlsx"){

                exportTableAsXLSX(config.tableId, config.filename, config.sheet);

            }

            else{

                exportTableAsCSV(config.tableId, config.filename);

            }

        });

    });

    document.getElementById("reportCustomFilterBtn")
        ?.addEventListener("click", () => {

            if(typeof flashQuickFilters === "function") flashQuickFilters();

        });

    document.getElementById("reportCustomPrintBtn")
        ?.addEventListener("click", printCurrentView);

});
