function getLocation() {
    // Prüfen, ob der Browser Geolocation unterstützt
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                // Alert zeigt die Daten an
                alert(
                    "Breitengrad: " + position.coords.latitude + "\n" +
                    "Längengrad: " + position.coords.longitude
                );
            },
            function(error) {
                // Fehlerbehandlung, falls der Nutzer ablehnt oder etwas schiefläuft
                alert("Fehler beim Abrufen der Position: " + error.message);
            }
        );
    } else {
        alert("Geolocation wird von deinem Browser nicht unterstützt.");
    }
}