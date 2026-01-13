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
let hasGPS = false; 

// Navigation (Jetzt über GPS Laufrichtung)
let gpsHeading = 0; 
let bearing = 0;
let distanceMeters = 0;

// Spiel-Logik
let gameActive = false;       
let timeInZone = 0;           
let zoneDuration = 3000;      
let hasWon = false;           

// UI Elemente
let startBtn;

function setup() {
  createCanvas(windowWidth, windowHeight);
  textSize(16);
  textAlign(CENTER, CENTER);

  startBtn = createButton('Spiel starten / Neues Ziel');
  startBtn.position(width/2 - 100, height - 80);
  startBtn.size(200, 50);
  startBtn.mousePressed(startNewGame);
  startBtn.attribute('disabled', ''); 

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
  
  // Wir nutzen die Bewegungsrichtung vom GPS (coords.heading)
  if (position.coords.heading !== null) {
    gpsHeading = position.coords.heading;
  }
  
  if (!hasGPS) {
    hasGPS = true;
    startBtn.removeAttribute('disabled'); 
    startBtn.html("Start: Zufallsziel suchen");
  }
  
  if (gameActive || hasWon) {
    distanceMeters = calcGeoDistance(currentLat, currentLon, targetLat, targetLon);
    bearing = calcBearing(currentLat, currentLon, targetLat, targetLon);
  }
}

function generateRandomTarget() {
  let distMeters = random(20, 30); // Dein gewünschter Bereich
  let angleDeg = random(0, 360);
  let earthRadius = 6371000; 
  
  let dx = distMeters * sin(radians(angleDeg));
  let dy = distMeters * cos(radians(angleDeg));

  let deltaLat = (dy / earthRadius) * (180 / PI);
  let deltaLon = (dx / (earthRadius * cos(radians(currentLat)))) * (180 / PI);

  targetLat = currentLat + deltaLat;
  targetLon = currentLon + deltaLon;
}

// =======================
// INTERAKTION
// =======================

async function startNewGame() {
  await Tone.start(); 

  hasWon = false;
  timeInZone = 0;
  gameActive = true;
  generateRandomTarget();
  
  if (!player) {
    player = new Tone.Player({
      url: "audio/sine_beep.mp3", 
      autostart: false
    }).toDestination();
  }

  if (!loopRunning) {
    loopRunning = true;
    startLoop();
  }
  
  startBtn.hide();
}

// =======================
// DRAW LOOP (VISUALISIERUNG)
// =======================

function draw() {
  let baseSize = min(width, height);
  
  if (gameActive && !hasWon) {
    checkWinCondition();
    let progress = constrain(timeInZone / zoneDuration, 0, 1);
    let bgColor = lerpColor(color(240), color(100, 255, 100), progress);
    background(bgColor);
  } else if (hasWon) {
    background(0, 255, 0);
  } else {
    background(200);
  }

  fill(0);
  noStroke();
  
  if (!hasGPS) {
    textSize(baseSize * 0.05);
    text("Warte auf GPS Signal...", width/2, height/2);
    return;
  }

  if (hasWon) {
    textSize(baseSize * 0.1);
    text("ZIEL ERREICHT!", width/2, height/2 - baseSize * 0.1);
    textSize(baseSize * 0.05);
    text("Gute Arbeit.", width/2, height/2);
  }

  if (gameActive && !hasWon) {
    textSize(baseSize * 0.04);
    text("Lauf los zum Signal...", width/2, height * 0.1);
    
    textSize(baseSize * 0.1);
    text(round(distanceMeters) + " m", width/2, height * 0.18);

    if (distanceMeters < 5) {
      fill(0, 100, 0);
      textSize(baseSize * 0.04);
      let secondsLeft = ((zoneDuration - timeInZone) / 1000).toFixed(1);
      text(`Stehen bleiben! ${secondsLeft}s`, width/2, height * 0.25);
    }

    drawCompassArrow(baseSize);
  }
}

function drawCompassArrow(s) {
  push();
  translate(width / 2, height / 2);
  
  // Nutzt die GPS Laufrichtung (gpsHeading) statt den Magnet-Kompass
  let angleToTarget = radians(bearing - gpsHeading);
  rotate(angleToTarget);
  
  let arrowSize = s * 0.2; 
  stroke(0);
  strokeWeight(max(1, s * 0.005));
  fill(255, 50, 50); 
  
  beginShape();
  vertex(0, -arrowSize);           
  vertex(arrowSize * 0.4, arrowSize * 0.5);   
  vertex(0, arrowSize * 0.2);      
  vertex(-arrowSize * 0.4, arrowSize * 0.5);  
  endShape(CLOSE);
  
  fill(0);
  noStroke();
  textSize(s * 0.05);
  text("Ziel", 0, -arrowSize - (s * 0.05));
  pop();
}

function checkWinCondition() {
  if (distanceMeters < 5) {
    timeInZone += deltaTime; 
    if (timeInZone >= zoneDuration) {
      gameWin();
    }
  } else {
    timeInZone = 0;
  }
}

function gameWin() {
  hasWon = true;
  gameActive = false;
  stopLoop(); 
  startBtn.show();
  startBtn.html("Neues Ziel bestimmen");
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
  let distClamped = constrain(distanceMeters, 1, 30);
  let interval = map(distClamped, 0, 30, 0.1, 1.5);

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

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  startBtn.position(width/2 - 100, height - 80);
}
