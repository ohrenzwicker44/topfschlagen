function getLocation() {
    navigator.geolocation.getCurrentPosition(pos => {
        alert("Lat: " + pos.coords.latitude + " / Lon: " + pos.coords.longitude);
    });
}