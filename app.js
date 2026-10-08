const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');

const stateVal = document.getElementById('state-val');
const angleVal = document.getElementById('angle-val');
const feedbackVal = document.getElementById('feedback-val');
const totalShotsVal = document.getElementById('total-shots-val');
const formScoreVal = document.getElementById('form-score-val');

// FEATURE 2: Global State Tracking Variables
let totalShots = 0;
let goodShots = 0;
let isDipping = false; // State latch: ensures 1 shot = 1 count

// Calculate 2D joint angle at point B given (A, B, C)
function calculateAngle(a, b, c) {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180.0) {
    angle = 360.0 - angle;
  }
  return angle;
}

// FEATURE 1: Text-to-Speech Helper Function
function speakFeedback(text) {
  if ('speechSynthesis' in window && !window.speechSynthesis.speaking) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.pitch = 1.0;
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  }
}

function onResults(results) {
  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

  if (results.poseLandmarks) {
    const landmarks = results.poseLandmarks;

    // Right Shoulder (12), Right Elbow (14), Right Wrist (16)
    const shoulder = landmarks[12];
    const elbow = landmarks[14];
    const wrist = landmarks[16];

    // Calculate Shooting Elbow Extension Angle
    const elbowAngle = calculateAngle(shoulder, elbow, wrist);
    angleVal.innerText = `${Math.round(elbowAngle)}°`;

    // Basketball Shot State Machine & Rep Counter Logic
    if (wrist.y > shoulder.y) {
      // Step 1: Player dips / gathers the ball below shoulder height
      isDipping = true;
      stateVal.innerText = "SET / DIP";
      stateVal.style.color = "#FFB300";
      feedbackVal.innerText = "Gathering ball. Prepare release...";
    } 
    else if (isDipping && elbowAngle >= 150 && wrist.y < shoulder.y) {
      // Step 2: Player releases into full arm extension (Triggers only ONCE per rep)
      isDipping = false; // Reset latch lock
      totalShots++;
      goodShots++; // Increments good form shot count

      const scorePercent = Math.round((goodShots / totalShots) * 100);
      totalShotsVal.innerText = totalShots;
      formScoreVal.innerText = `${scorePercent}%`;

      stateVal.innerText = "RELEASE";
      stateVal.style.color = "#00E676";
      feedbackVal.innerText = "GOOD FOLLOW-THROUGH! High arc extension.";
      
      speakFeedback("Good follow through");
    } 
    else if (wrist.y <= shoulder.y && elbowAngle < 120) {
      stateVal.innerText = "SET POINT";
      stateVal.style.color = "#2196F3";
      feedbackVal.innerText = "Keep elbow tucked in line with basket.";
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