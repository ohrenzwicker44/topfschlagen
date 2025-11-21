function getLocation() {
    navigator.geolocation.getCurrentPosition(position => {
        console.log("Breitengrad:", position.coords.latitude);
        console.log("Längengrad:", position.coords.longitude);
    });
}