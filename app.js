const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');

const stateVal = document.getElementById('state-val');
const angleVal = document.getElementById('angle-val');
const feedbackVal = document.getElementById('feedback-val');
const totalShotsVal = document.getElementById('total-shots-val');
const formScoreVal = document.getElementById('form-score-val');
const statusBadge = document.getElementById('status-badge');
const btnToggle = document.getElementById('btn-toggle');

// Session & AI Model Variables
let isTrackingActive = false;
let totalShots = 0;
let goodShots = 0;
let isDipping = false;

// Visual Model Variables
let objectModel = null;
let ballTrail = []; // Stores recent (x, y) centroids of the basketball to render trajectory
const MAX_TRAIL_POINTS = 25;

// Load COCO-SSD Object Detection Model
cocoSsd.load().then((loadedModel) => {
  objectModel = loadedModel;
  statusBadge.innerText = "Standby";
  feedbackVal.innerText = "Tap 'Start Tracking' to begin...";
  btnToggle.innerText = "▶ Start Tracking";
  btnToggle.disabled = false;
  console.log("TensorFlow.js COCO-SSD Model Loaded!");
});

// Button Click Event
btnToggle.addEventListener('click', () => {
  if (!isTrackingActive) {
    isTrackingActive = true;
    totalShots = 0;
    goodShots = 0;
    isDipping = false;
    ballTrail = [];

    totalShotsVal.innerText = "0";
    formScoreVal.innerText = "0%";
    statusBadge.innerText = "Tracking Active";
    statusBadge.classList.add('active');

    btnToggle.innerText = "↺ Reset Session";
    btnToggle.className = "btn-reset";

    speakFeedback("Tracking started");
  } else {
    isTrackingActive = false;
    totalShots = 0;
    goodShots = 0;
    isDipping = false;
    ballTrail = [];

    totalShotsVal.innerText = "0";
    formScoreVal.innerText = "0%";
    stateVal.innerText = "IDLE";
    stateVal.style.color = "#00e676";
    statusBadge.innerText = "Standby";
    statusBadge.classList.remove('active');
    feedbackVal.innerText = "Session reset. Tap 'Start Tracking' to begin...";

    btnToggle.innerText = "▶ Start Tracking";
    btnToggle.className = "btn-start";

    speakFeedback("Session reset");
  }
});

// Calculate 2D joint angle
function calculateAngle(a, b, c) {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  return angle > 180.0 ? 360.0 - angle : angle;
}

// Speech Synthesis Helper
function speakFeedback(text) {
  if ('speechSynthesis' in window && !window.speechSynthesis.speaking) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.pitch = 1.0;
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  }
}

// Detect Basketball using TensorFlow.js COCO-SSD
async function detectBall() {
  if (!objectModel || !videoElement.videoWidth) return;

  const predictions = await objectModel.detect(videoElement);
  
  // Look for detected 'sports ball' or 'ball'
  const ballPrediction = predictions.find(
    (p) => p.class === 'sports ball' || p.class === 'ball'
  );

  if (ballPrediction) {
    const [x, y, width, height] = ballPrediction.bbox;
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    // Store centroid for trajectory line
    ballTrail.push({ x: centerX, y: centerY });
    if (ballTrail.length > MAX_TRAIL_POINTS) {
      ballTrail.shift();
    }

    // Draw Basketball Bounding Box
    canvasCtx.strokeStyle = '#FF6D00'; // Basketball Orange
    canvasCtx.lineWidth = 3;
    canvasCtx.strokeRect(x, y, width, height);

    canvasCtx.fillStyle = '#FF6D00';
    canvasCtx.font = '14px sans-serif';
    canvasCtx.fillText(
      `Basketball (${Math.round(ballPrediction.score * 100)}%)`,
      x,
      y > 10 ? y - 5 : 10
    );
  }
}

// Draw Ball Trajectory Arc
function drawBallTrajectory() {
  if (ballTrail.length < 2) return;

  canvasCtx.beginPath();
  canvasCtx.moveTo(ballTrail[0].x, ballTrail[0].y);

  for (let i = 1; i < ballTrail.length; i++) {
    canvasCtx.lineTo(ballTrail[i].x, ballTrail[i].y);
  }

  canvasCtx.strokeStyle = '#FFD600'; // Bright Yellow Trajectory Arc
  canvasCtx.lineWidth = 4;
  canvasCtx.stroke();
}

async function onResults(results) {
  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

  // 1. Run Visual Ball Detection
  if (isTrackingActive) {
    await detectBall();
    drawBallTrajectory();
  }

  // 2. Run Pose Skeleton Biomechanics
  if (results.poseLandmarks) {
    const landmarks = results.poseLandmarks;

    const shoulder = landmarks[12];
    const elbow = landmarks[14];
    const wrist = landmarks[16];

    const elbowAngle = calculateAngle(shoulder, elbow, wrist);
    angleVal.innerText = `${Math.round(elbowAngle)}°`;

    if (isTrackingActive) {
      if (wrist.y > shoulder.y) {
        isDipping = true;
        stateVal.innerText = "SET / DIP";
        stateVal.style.color = "#FFB300";
        feedbackVal.innerText = "Gathering ball. Prepare release...";
      } else if (isDipping && elbowAngle >= 150 && wrist.y < shoulder.y) {
        isDipping = false;
        totalShots++;
        goodShots++;

        const scorePercent = Math.round((goodShots / totalShots) * 100);
        totalShotsVal.innerText = totalShots;
        formScoreVal.innerText = `${scorePercent}%`;

        stateVal.innerText = "RELEASE";
        stateVal.style.color = "#00E676";
        feedbackVal.innerText = "GOOD FOLLOW-THROUGH! Ball arc tracked.";

        speakFeedback("Good follow through");
      } else if (wrist.y <= shoulder.y && elbowAngle < 120) {
        stateVal.innerText = "SET POINT";
        stateVal.style.color = "#2196F3";
        feedbackVal.innerText = "Keep elbow tucked in line with basket.";
      }
    }

    // Draw Skeleton
    drawConnectors(canvasCtx, landmarks, POSE_CONNECTIONS, { color: '#00E676', lineWidth: 3 });
    drawLandmarks(canvasCtx, landmarks, { color: '#FF0055', lineWidth: 1, radius: 4 });
  }

  canvasCtx.restore();
}

// Initialize MediaPipe Pose Model
const pose = new Pose({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
});

pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

pose.onResults(onResults);

const camera = new Camera(videoElement, {
  onFrame: async () => {
    await pose.send({ image: videoElement });
  },
  width: 640,
  height: 480
});

camera.start();