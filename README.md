# Irish Green
# AI Basketball Shot Mechanics & Trajectory Analyzer

An executive-grade, web-based computer vision application that performs real-time biomechanical analysis of basketball shooting form and tracks ball trajectory arcs directly in mobile and desktop browsers.

[![Live Demo](https://img.shields.io/badge/Live_Demo-GitHub_Pages-00E676?style=for-the-badge&logo=github)](https://tamukatom.github.io/Irish-Green/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Pose-0072C6?style=for-the-badge)](https://developers.google.com/mediapipe)
[![TensorFlow.js](https://img.shields.io/badge/TensorFlow.js-COCO--SSD-FF6F00?style=for-the-badge&logo=tensorflow)](https://www.tensorflow.org/js)

---

## 🌟 Key Features

* **Real-Time Biomechanical Pose Tracking:** Extracts 33 3D skeletal body keypoints at 30+ FPS using **MediaPipe Pose** to evaluate elbow extension, knee loading, and set-point alignment.
* **Visual Ball Object Detection:** Utilizes a **TensorFlow.js COCO-SSD** neural network to track basketball bounding boxes and plot flight trajectory arcs in real time.
* **Multimodal Voice Coaching:** Integrates the **Web Speech API** to provide hands-free audio feedback ("Good follow through", "Flat arc") through smartphone speakers during shooting reps.
* **Finite State Machine (FSM) Shot Counter:** Implements a single-latch state engine (*Dip $\rightarrow$ Set Point $\rightarrow$ Release*) to prevent multi-frame double counting and measure session form efficiency.
* **Asynchronous Frame Throttling:** Optimized for mobile WebGL/GPU constraints by decoupling object detection frame rate from live canvas rendering.
* **Persistent Session History:** Stores workout logs, rep totals, and accuracy scores locally using the browser's **Web Storage API (`localStorage`)**.

---

## 📐 Biomechanical Angle Mathematics

Joint angle calculations ($\theta$) at vertex joint $B(x_2, y_2)$ given adjacent joints $A(x_1, y_1)$ (e.g., Shoulder) and $C(x_3, y_3)$ (e.g., Wrist) are derived in real time using 2D vector trigonometry:

$$\theta = \left\vert{} \arctan2(y_3 - y_2, x_3 - x_2) - \arctan2(y_1 - y_2, x_1 - x_2) \right\vert{} \times \frac{180}{\pi}$$

If $\theta > 180^\circ$, the interior angle is normalized as:

$$\theta = 360^\circ - \theta$$

---

## 🏗️ System Architecture

```text
       ┌────────────────────────────────────────────────────────┐
       │             User Web Camera Stream (HTML5)             │
       └───────────────────────────┬────────────────────────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              ▼                                         ▼
   ┌───────────────────────┐               ┌────────────────────────┐
   │ MediaPipe Pose Model  │               │ TensorFlow.js COCO-SSD │
   │  (Skeletal Keypoints) │               │   (Object Detection)   │
   └──────────┬────────────┘               └───────────┬────────────┘
              │                                        │ (Async Throttled)
              ▼                                        ▼
   ┌───────────────────────┐               ┌────────────────────────┐
   │ Biomechanical Angle   │               │ Ball Bounding Box &    │
   │ Math & State Engine   │               │ Flight Trajectory Arc  │
   └──────────┬────────────┘               └───────────┬────────────┘
              │                                        │
              └────────────────────┬───────────────────┘
                                   │
                                   ▼
              ┌─────────────────────────────────────────┐
              │ HTML5 Canvas Overlay & Multimodal Audio │
              └─────────────────────────────────────────┘