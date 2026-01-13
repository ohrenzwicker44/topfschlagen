// =======================
// GLOBALE VARIABLEN
// =======================

// Audio & Loop
let player = null;
let loopRunning = false;
let eventId = null;

// GPS Positionen
let currentLat = 0;
let currentLon = 0;
let targetLat = 0;
let targetLon = 0;
let hasGPS = false; // Haben wir schon ein Signal?

// Kompass & Navigation
let heading = 0;
let bearing = 0;
let distanceMeters = 0;

// Spiel-Logik
let gameActive = false;       // Läuft das Spiel gerade?
let timeInZone = 0;           // Wie lange (ms) steht der Spieler schon im Zielkreis?
let zoneDuration = 3000;      // 3 Sekunden müssen erreicht werden
let hasWon = false;           // Ziel erreicht?

// UI Elemente
let startBtn;

function setup() {
  createCanvas(windowWidth, windowHeight);
  textSize(16);
  textAlign(CENTER, CENTER);

  // Button erstellen (wird je nach Zustand ein-/ausgeblendet)
  startBtn = createButton('Spiel starten / Neues Ziel');
  startBtn.position(width/2 - 100, height - 80);
  startBtn.size(200, 50);
  startBtn.mousePressed(startNewGame);
  // Button erst deaktivieren, bis GPS da ist
  startBtn.attribute('disabled', ''); 

  // GPS Tracking starten
  if (navigator.geolocation) {
    navigator.geolocation.watchPosition(updatePosition, (err) => {
      console.warn('GPS ERROR(' + err.code + '): ' + err.message);
    }, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 5000
    });
  } else {
    alert("Geolocation nicht unterstützt.");
  }
}

// =======================
// GPS UPDATE & MATHE
// =======================

function updatePosition(position) {
  currentLat = position.coords.latitude;
  currentLon = position.coords.longitude;
  
  if (!hasGPS) {
    hasGPS = true;
    startBtn.removeAttribute('disabled'); // Jetzt darf man starten
    startBtn.html("Start: Zufallsziel suchen");
  }
  
  // Wenn Spiel aktiv, berechne Abstand zum Ziel
  if (gameActive || hasWon) {
    distanceMeters = calcGeoDistance(currentLat, currentLon, targetLat, targetLon);
    bearing = calcBearing(currentLat, currentLon, targetLat, targetLon);
  }
}

// Generiert neue Zielkoordinaten (100m - 150m entfernt)
function generateRandomTarget() {
  // Zufälliger Abstand zwischen 100 und 150 Metern
  let distMeters = random(100, 150);
  // Zufälliger Winkel (0 bis 360 Grad)
  let angleDeg = random(0, 360);
  
  // Umrechnung in Koordinaten (Vereinfachte Projektion für kurze Distanzen)
  // 1 Grad Breite ca. 111km, 1 Grad Länge variiert je nach Breite
  let earthRadius = 6371000; // Meter
  
  let dx = distMeters * sin(radians(angleDeg));
  let dy = distMeters * cos(radians(angleDeg));

  let deltaLat = (dy / earthRadius) * (180 / PI);
  let deltaLon = (dx / (earthRadius * cos(radians(currentLat)))) * (180 / PI);

  targetLat = currentLat + deltaLat;
  targetLon = currentLon + deltaLon;
  
  console.log(`Neues Ziel: ${distMeters.toFixed(1)}m entfernt, Winkel ${angleDeg.toFixed(0)}°`);
}

// =======================
// INTERAKTION (BUTTON & KLICK)
// =======================

async function startNewGame() {
  await Tone.start(); // Audio Context wecken
  
  // Kompass-Erlaubnis für iOS (falls noch nicht geschehen)
  requestCompassPermission();

  // Spiel zurücksetzen
  hasWon = false;
  timeInZone = 0;
  gameActive = true;
  
  // Neues Ziel berechnen
  generateRandomTarget();
  
  // Audio starten
  if (!player) {
    player = new Tone.Player({
      url: "audio/sine_beep.mp3", 
      autostart: false
    }).toDestination();
  }

  // Loop starten
  if (!loopRunning) {
    loopRunning = true;
    startLoop();
  }
  
  // Button verstecken während des Spiels
  startBtn.hide();
}

function requestCompassPermission() {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission()
      .then(response => {
        if (response === 'granted') {
          window.addEventListener('deviceorientation', handleOrientation);
        }
      })
      .catch(console.error);
  } else {
    window.addEventListener('deviceorientation', handleOrientation);
  }
}

function handleOrientation(event) {
  if (event.webkitCompassHeading) {
    heading = event.webkitCompassHeading;
  } else {
    heading = 360 - event.alpha; 
  }
}

// =======================
// DRAW LOOP (VISUALISIERUNG & LOGIK)
// =======================

function draw() {
  // 1. Hintergrund-Logik (Farbverlauf)
  if (gameActive && !hasWon) {
    checkWinCondition();
    
    // Berechne Farbe: Standard Grau/Rot -> Grün je mehr Zeit im Ziel
    let progress = constrain(timeInZone / zoneDuration, 0, 1);
    // Von Hellgrau (240) zu Sattem Grün (0, 255, 0)
    let bgColor = lerpColor(color(240, 240, 240), color(100, 255, 100), progress);
    background(bgColor);
    
  } else if (hasWon) {
    background(0, 255, 0); // Sieg = Komplett Grün
  } else {
    background(200); // Warten auf Start
  }

  // 2. Text Informationen
  fill(0);
  noStroke();
  
  if (!hasGPS) {
    text("Warte auf GPS Signal...", width/2, height/2);
    return;
  }

  if (hasWon) {
    textSize(32);
    text("ZIEL ERREICHT!", width/2, height/2 - 50);
    textSize(18);
    text("Gute Arbeit.", width/2, height/2);
    return; // Wenn gewonnen, zeichnen wir keinen Pfeil mehr
  }

  if (gameActive) {
    // Info Text oben
    textSize(16);
    text("Suche das Signal...", width/2, 40);
    
    textSize(30);
    text(round(distanceMeters) + " m", width/2, 80);

    // Fortschrittsbalken oder Text für die 3 Sekunden
    if (distanceMeters < 10) {
      fill(0, 100, 0);
      textSize(14);
      let secondsLeft = ((zoneDuration - timeInZone) / 1000).toFixed(1);
      text(`Halten! ${secondsLeft}s`, width/2, 120);
    }

    // Pfeil zeichnen
    drawCompassArrow();
  }
}

function checkWinCondition() {
  // Logik: Ist der Spieler näher als 10m?
  if (distanceMeters < 10) {
    timeInZone += deltaTime; // deltaTime ist die Zeit seit dem letzten Frame in ms
    
    if (timeInZone >= zoneDuration) {
      gameWin();
    }
  } else {
    // Wenn man den Kreis verlässt, wird der Timer zurückgesetzt (oder langsam verringert?)
    // Hier: Sofort Reset für mehr Schwierigkeit.
    timeInZone = 0;
  }
}

function gameWin() {
  hasWon = true;
  gameActive = false;
  stopLoop(); // Audio aus
  
  // Button wieder anzeigen für neue Runde
  startBtn.show();
  startBtn.html("Neues Ziel bestimmen");
}

function drawCompassArrow() {
  push();
  translate(width / 2, height / 2);
  let angleToTarget = radians(bearing - heading);
  rotate(angleToTarget);
  
  stroke(0);
  strokeWeight(2);
  fill(255, 50, 50); 
  
  // Pfeil-Form
  beginShape();
  vertex(0, -60);
  vertex(20, 30);
  vertex(0, 15);
  vertex(-20, 30);
  endShape(CLOSE);
  
  fill(0);
  noStroke();
  text("Ziel", 0, -80);
  pop();
}

// =======================
// AUDIO-LOGIK
// =======================

function startLoop() {
  Tone.Transport.start();
  scheduleNext(Tone.Transport.seconds);
}

function stopLoop() {
  loopRunning = false;
  if (eventId !== null) {
    Tone.Transport.clear(eventId);
    eventId = null;
  }
}

function scheduleNext(time) {
  // Je näher, desto schneller (bis 10m). Unter 10m Dauerton oder sehr schnell.
  let distClamped = constrain(distanceMeters, 1, 150);
  let interval = map(distClamped, 0, 150, 0.1, 1.5);

  eventId = Tone.Transport.scheduleOnce((t) => {
    if (!player) return;
    player.start(t);
    if (loopRunning) {
      scheduleNext(t + interval);
    }
  }, time);
}

// =======================
// MATHE HELFER
// =======================

function calcGeoDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; 
  const phi1 = radians(lat1);
  const phi2 = radians(lat2);
  const dPhi = radians(lat2 - lat1);
  const dLambda = radians(lon2 - lon1);

  const a = sin(dPhi / 2) * sin(dPhi / 2) +
            cos(phi1) * cos(phi2) *
            sin(dLambda / 2) * sin(dLambda / 2);
  const c = 2 * atan2(sqrt(a), sqrt(1 - a));
  return R * c;
}

function calcBearing(lat1, lon1, lat2, lon2) {
  const y = sin(radians(lon2 - lon1)) * cos(radians(lat2));
  const x = cos(radians(lat1)) * sin(radians(lat2)) -
            sin(radians(lat1)) * cos(radians(lat2)) * cos(radians(lon2 - lon1));
  const brng = degrees(atan2(y, x));
  return (brng + 360) % 360; 
}