let gps;
let points = [];

function setup() {
  noCanvas();
  gps = new p5.Geolocation();
}

function savePoint() {
  gps.getCurrentPosition(pos => {
    if (points.length < 2) {
      points.push({
        lat: pos.latitude,
        lon: pos.longitude
      });

      localStorage.setItem("gpsPoints", JSON.stringify(points));
      console.log("Gespeichert:", points);
    } else {
      console.log("Schon 2 Punkte gespeichert");
    }
  });
}