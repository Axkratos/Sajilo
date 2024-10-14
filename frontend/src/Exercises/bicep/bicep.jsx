import React, { useRef, useState, useEffect } from "react";
import { Pose } from "@mediapipe/pose";
import * as cam from "@mediapipe/camera_utils";
import axios from 'axios';
import { Container, Typography, Box, Button, Grid, Card, CardMedia, Paper, CardContent } from "@mui/material";
import bicep from "./bicep.mp4";

const ExercisePose = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [feedback, setFeedback] = useState("Press Start to begin");
  const [camera, setCamera] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false); // State for pause
  const [timer, setTimer] = useState(0);
  const [repCount, setRepCount] = useState(0);
  const [performanceScore, setPerformanceScore] = useState(50); // This will control the vertical bar

  useEffect(() => {
    let cameraInstance;
    let timerInterval;

    const pose = new Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    pose.onResults((results) => {
      if (!results.poseLandmarks) {
        setFeedback("No person detected");
        return;
      }

      const canvasElement = canvasRef.current;
      const canvasCtx = canvasElement.getContext("2d");

      // Clear canvas
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

      // Draw the arm landmarks (elbow, wrist, shoulder)
      drawArmPose(results, canvasCtx);

      // Logic to provide feedback based on exercise form
      calculateExercise(results);
    });

    if (isCameraActive && !isPaused) {
      if (videoRef.current) {
        cameraInstance = new cam.Camera(videoRef.current, {
          onFrame: async () => {
            await pose.send({ image: videoRef.current });
          },
          width: 640,
          height: 480,
        });
        cameraInstance.start();
        setCamera(cameraInstance);
        setFeedback("Camera started. Begin your exercise.");

        // Start timer
        timerInterval = setInterval(() => setTimer((prev) => prev + 1), 1000);
      }
    } else if (cameraInstance) {
      cameraInstance.stop();
      clearInterval(timerInterval);
    }

    return () => {
      if (cameraInstance) {
        cameraInstance.stop();
      }
      clearInterval(timerInterval);
    };
  }, [isCameraActive, isPaused]);

  const calculateExercise = async (results) => {
    const landmarks = results.poseLandmarks;
    const leftShoulder = landmarks[11];
    const leftElbow = landmarks[13];
    const leftWrist = landmarks[15];
    const rightShoulder = landmarks[12];
    const rightElbow = landmarks[14];
    const rightWrist = landmarks[16];

    // Calculate angles for both arms
    const leftAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
    const rightAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);

    // Detect curl posture for both arms
    const isLeftCurl = leftWrist.y < rightWrist.y;
    const currentAngle = isLeftCurl ? leftAngle : rightAngle;

    // Give feedback based on the current arm and angle
    if (currentAngle < 30) {
      setFeedback("Keep your elbows close to your body.");
    } else if (currentAngle > 160) {
      setFeedback("Extend fully at the bottom of your curl.");
    } else if (currentAngle > 80 && currentAngle < 100) {
      setFeedback("Halfway there! Keep curling.");
    } else {
      setFeedback("Maintain good posture! Keep going.");
    }

    // Performance score calculation based on the angle (you can fine-tune this formula)
    const score = Math.max(0, 100 - Math.abs(currentAngle - 90));
    setPerformanceScore(score); // Update the vertical progress bar score

    // Send data to backend to count reps
    await sendRepData(currentAngle);
  };

  const sendRepData = async (currentAngle) => {
    try {
      const response = await axios.post('https://sajilorehab.onrender.com/api/count_reps', {
        angle: currentAngle,  // Send the angle for counting reps
      });
      setRepCount(response.data.reps); // Update rep count from response
    } catch (error) {
      console.error('Error sending rep data:', error);
    }
  };

  const calculateAngle = (a, b, c) => {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180) angle = 360 - angle;
    return angle;
  };

  const drawArmPose = (results, canvasCtx) => {
    const poseLandmarks = results.poseLandmarks;
    const armLandmarks = [11, 13, 15, 12, 14, 16]; // Left and Right shoulder, elbow, wrist

    canvasCtx.save();
    canvasCtx.lineWidth = 4;
    canvasCtx.strokeStyle = "lime"; // Color for the connecting lines

    // Draw lines connecting shoulder -> elbow -> wrist (left and right arms)
    const drawLine = (start, end) => {
      canvasCtx.beginPath();
      canvasCtx.moveTo(poseLandmarks[start].x * 640, poseLandmarks[start].y * 480); // Move to the start point
      canvasCtx.lineTo(poseLandmarks[end].x * 640, poseLandmarks[end].y * 480);     // Draw line to the end point
      canvasCtx.stroke();
    };

    // Left arm: shoulder (11) -> elbow (13) -> wrist (15)
    drawLine(11, 13); // Shoulder to Elbow (left)
    drawLine(13, 15); // Elbow to Wrist (left)

    // Right arm: shoulder (12) -> elbow (14) -> wrist (16)
    drawLine(12, 14); // Shoulder to Elbow (right)
    drawLine(14, 16); // Elbow to Wrist (right)

    // Draw the line connecting the two shoulders (left shoulder (11) -> right shoulder (12))
    drawLine(11, 12);

    // Draw circles for each landmark (elbow, wrist, shoulder)
    armLandmarks.forEach((index) => {
      const landmark = poseLandmarks[index];
      canvasCtx.beginPath();
      canvasCtx.arc(landmark.x * 640, landmark.y * 480, 5, 0, 2 * Math.PI);
      canvasCtx.fillStyle = "aqua"; // Color for the dots
      canvasCtx.fill();
    });

    canvasCtx.restore();
  };

  const handleStartCamera = () => {
    setIsCameraActive(true);
    setTimer(0);
    setRepCount(0);
    setFeedback("Get ready to start!");
  };

  const handleStopCamera = () => {
    if (camera) {
      camera.stop();  // Stop the camera instance
    }
    setIsCameraActive(false); // Disable camera
    setIsPaused(false);       // Reset the pause state
    setTimer(0);              // Reset the timer
    setRepCount(0);           // Reset the rep count
    setFeedback("Exercise stopped. All parameters reset."); // Reset feedback
  };

  const handlePauseCamera = () => {
    setIsPaused((prev) => !prev);
    setFeedback(isPaused ? "Resumed!" : "Paused. Resume to continue.");
  };

  return (
    <Container maxWidth="lg">
      <Typography variant="h3" align="center" gutterBottom>
        Bicep Tracker
      </Typography>

      <Grid container spacing={2}>
        {/* Camera feed with skeleton and progress bar */}
        <Grid item xs={7}>
          <Box position="relative" width="640px" height="480px">
            {/* Video Feed */}
            <video ref={videoRef} style={{ position: "absolute", width: "640px", height: "480px", zIndex: 1 }} playsInline />
            {/* Canvas Overlay */}
            <canvas ref={canvasRef} width="640" height="480" style={{ position: "absolute", zIndex: 2 }} />

            {/* Vertical Feedback Bar Overlay */}
            <Box
              sx={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '30px',
                height: '300px',
                border: '2px solid #ccc',
                backgroundColor: '#f0f0f0',
                overflow: 'hidden'
              }}
            >
              {/* Dynamic vertical bar */}
              <Box
                sx={{
                  width: '100%',
                  height: `${performanceScore}%`,
                  backgroundColor: performanceScore > 80 ? 'green' : 'red',
                  position: 'absolute',
                  bottom: 0
                }}
              />
            </Box>
          </Box>
        </Grid>

        {/* Right side: Recommended card and tutorial video */}
        <Grid item xs={5}>
          {/* Recommended Card */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6">Recommended</Typography>
              <Typography>Difficulty: Easy</Typography>
              <Typography>Duration: {timer} seconds</Typography>
              <Typography>Reps: {repCount}</Typography>
              <Typography>Feedback: {feedback}</Typography>
              <Button onClick={handleStartCamera} variant="contained" color="primary" sx={{ mr: 2 }} disabled={isCameraActive}>
                Start
              </Button>

              <Button
                onClick={handlePauseCamera}
                variant="contained"
                color="warning"
                sx={{ mr: 2 }}
                style={{ display: isCameraActive ? 'inline-block' : 'none' }}  // Show Pause/Resume only when the camera is active
              >
                {isPaused ? "Resume" : "Pause"}
              </Button>

              <Button
                onClick={handleStopCamera}
                variant="contained"
                color="secondary"
                sx={{ mr: 2 }}
                style={{ display: isCameraActive || isPaused ? 'inline-block' : 'none' }}  // Show Stop when camera is active or paused
              >
                Stop
              </Button>
            </CardContent>
          </Card>

          {/* Tutorial Video */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6">Tutorial Video</Typography>
            <CardMedia component="video" controls src={bicep} />
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default ExercisePose;
