document.addEventListener("DOMContentLoaded", function() {
    var blocker = document.createElement("div");

    blocker.style.position = "fixed";
    blocker.style.top = "0";
    blocker.style.left = "0";
    blocker.style.width = "100%";
    blocker.style.height = "100%";
    blocker.style.backgroundColor = "rgba(0, 0, 0, 0)"; 
    blocker.style.zIndex = "9999";
    blocker.style.pointerEvents = "all";

    document.body.appendChild(blocker);
});
