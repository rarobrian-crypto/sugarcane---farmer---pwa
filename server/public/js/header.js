//------------------------------------------------------
// HEADER.JS
//------------------------------------------------------

document.addEventListener("DOMContentLoaded",function(){

    updateDateTime();

    setInterval(updateDateTime,1000);

});

function updateDateTime(){

    const box=document.getElementById("datetime");

    if(!box) return;

    const now=new Date();

    const options={

        weekday:"long",

        day:"numeric",

        month:"long",

        year:"numeric",

        hour:"2-digit",

        minute:"2-digit",

        second:"2-digit"

    };

    box.textContent=

        now.toLocaleString("en-KE",options);

}