import React, { useRef, useState, useEffect } from 'react';
import './App.css';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Pose } from '@mediapipe/pose';

// Placeholder necklace images (add your own in public/necklaces/)
const NECKLACES = [
  { src: '/necklaces/necklace1.png', type: 'short' },
  { src: '/necklaces/necklace2.png', type: 'regular' },
  { src: '/necklaces/necklace3.png', type: 'regular' },
];

function getNeckBase(landmarks: any, scaleX: number, scaleY: number) {
  // Use chin (152) and project downward from chin to estimate neck base
  const chin = landmarks[152];
  const jawLeft = landmarks[234];
  const jawRight = landmarks[454];

  // Calculate the center between jawLeft and jawRight
  const xCenter = (jawLeft.x + jawRight.x) / 2;
  const yCenter = (jawLeft.y + jawRight.y) / 2;

  // Project downward from chin by a factor of the distance between chin and jaw center
  const dx = chin.x - xCenter;
  const dy = chin.y - yCenter;
  const neckBaseX = chin.x + dx * 0.7; // 0.7 is a tunable factor
  const neckBaseY = chin.y + dy * 0.7;

  return {
    x: neckBaseX * scaleX,
    y: neckBaseY * scaleY
  };
}

function drawShortNecklace(ctx: CanvasRenderingContext2D, necklaceImg: HTMLImageElement, landmarks: any, canvas: HTMLCanvasElement, poseLandmarks: any) {
  const scaleX = canvas.width;
  const scaleY = canvas.height;
  if (poseLandmarks && poseLandmarks[11] && poseLandmarks[12] && landmarks && landmarks[152]) {
    // Shoulders
    const leftShoulder = poseLandmarks[11];
    const rightShoulder = poseLandmarks[12];
    // Chin (FaceMesh)
    const chin = landmarks[152];
    // Shoulder line midpoint
    const x1 = leftShoulder.x * scaleX;
    const y1 = leftShoulder.y * scaleY;
    const x2 = rightShoulder.x * scaleX;
    const y2 = rightShoulder.y * scaleY;
    const shoulderMidX = (x1 + x2) / 2;
    const shoulderMidY = (y1 + y2) / 2;
    // Chin position
    const chinX = chin.x * scaleX;
    const chinY = chin.y * scaleY;
    // Estimate neck base as a point between chin and shoulder line
    const neckBaseX = (chinX + shoulderMidX) / 2;
    const neckBaseY = (chinY + shoulderMidY) / 2;
    // Project a line from chin to each shoulder, find points 40% from shoulder towards chin
    const leftNeckX = x1 + 0.4 * (chinX - x1);
    const leftNeckY = y1 + 0.4 * (chinY - y1);
    const rightNeckX = x2 + 0.4 * (chinX - x2);
    const rightNeckY = y2 + 0.4 * (chinY - y2);
    const neckWidth = Math.sqrt((rightNeckX - leftNeckX) ** 2 + (rightNeckY - leftNeckY) ** 2);
    // Place necklace at neck base, scale to neck width (no extra scaling factor)
    const width = neckWidth;
    const height = necklaceImg.height * (width / necklaceImg.width);
    ctx.drawImage(
      necklaceImg,
      neckBaseX - width / 2,
      neckBaseY - height / 2,
      width,
      height
    );
  } else {
    // fallback to previous jaw-based logic
    const jawLeft = landmarks[234];
    const jawRight = landmarks[454];
    const x1 = jawLeft.x * scaleX;
    const y1 = jawLeft.y * scaleY;
    const x2 = jawRight.x * scaleX;
    const y2 = jawRight.y * scaleY;
    const neckBase = getNeckBase(landmarks, scaleX, scaleY);
    const jawWidth = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    const width = jawWidth * 0.95;
    const height = necklaceImg.height * (width / necklaceImg.width);
    ctx.drawImage(
      necklaceImg,
      neckBase.x - width / 2,
      neckBase.y - height / 2,
      width,
      height
    );
  }
}

function App() {
  const [photo, setPhoto] = useState<string | null>(null);
  const [selectedNecklace, setSelectedNecklace] = useState<string | null>(null);
  const [landmarks, setLandmarks] = useState<any>(null);
  const [poseLandmarks, setPoseLandmarks] = useState<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Handle photo upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => setPhoto(ev.target?.result as string);
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  // Download the try-on image
  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = 'jewellery-tryon.png';
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  // Run MediaPipe Face Mesh and Pose on the uploaded photo
  useEffect(() => {
    if (!photo || !imgRef.current) return;
    const img = imgRef.current;
    if (!img.complete) return;

    // FaceMesh setup (existing)
    const faceMesh = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });
    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.8,
      minTrackingConfidence: 0.8,
    });
    faceMesh.onResults((results: any) => {
      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        setLandmarks(results.multiFaceLandmarks[0]);
      }
    });

    // Pose setup (new)
    const pose = new Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });
    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.8,
      minTrackingConfidence: 0.8,
    });
    pose.onResults((results: any) => {
      if (results.poseLandmarks) {
        setPoseLandmarks(results.poseLandmarks);
      }
    });

    const runModels = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      await faceMesh.send({ image: canvas });
      await pose.send({ image: canvas });
    };
    runModels();
    // eslint-disable-next-line
  }, [photo]);

  // Draw the photo and necklace overlay on the canvas
  useEffect(() => {
    if (!photo || !landmarks || !canvasRef.current || !imgRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = imgRef.current;
    // Draw uploaded photo
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    // Draw necklace overlay if selected
    if (selectedNecklace) {
      const necklaceObj = NECKLACES.find(n => n.src === selectedNecklace);
      const necklaceImg = new window.Image();
      necklaceImg.src = selectedNecklace;
      necklaceImg.onload = () => {
        if (necklaceObj && necklaceObj.type === 'short') {
          drawShortNecklace(ctx, necklaceImg, landmarks, canvas, poseLandmarks);
        } else {
          // Use chin/neck landmarks for placement (landmarks 152, 234, 454)
          const chin = landmarks[152];
          const jawLeft = landmarks[234];
          const jawRight = landmarks[454];
          // Scale to canvas size
          const scaleX = canvas.width;
          const scaleY = canvas.height;
          const x1 = jawLeft.x * scaleX;
          const y1 = jawLeft.y * scaleY;
          const x2 = jawRight.x * scaleX;
          const y2 = jawRight.y * scaleY;
          const xc = chin.x * scaleX;
          const yc = chin.y * scaleY;
          // Calculate jawline width in pixels
          const jawWidth = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
          // Dynamically scale necklace width to jawline width
          const width = jawWidth * 1.15; // 1.15 for a little extra width
          const height = necklaceImg.height * (width / necklaceImg.width);
          // Center the necklace at the chin, with a slight downward offset
          ctx.drawImage(
            necklaceImg,
            xc - width / 2,
            yc - height / 6, // move slightly down from chin
            width,
            height
          );
        }
      };
    }
  }, [photo, landmarks, selectedNecklace, poseLandmarks]);

  return (
    <div className="App">
      <h1>CKC Jewellery Try-On</h1>
      <div className="tagline">Try on beautiful necklaces virtually!</div>
      <div className="main-row-container">
        <div className="upload-section">
          <input type="file" accept="image/*" onChange={handlePhotoUpload} />
        </div>
        {photo && (
          <div className="tryon-section">
            <canvas ref={canvasRef} width={400} height={500} style={{ display: 'block', margin: '0 auto' }} />
            <img
              ref={imgRef}
              src={photo}
              alt="Uploaded"
              style={{ display: 'none' }}
              id="uploaded-photo"
              onLoad={() => {
                // Triggers useEffect for face mesh
              }}
            />
            <button className="button-download" onClick={handleDownload}>Download Try-On Image</button>
          </div>
        )}
        <div className="necklace-catalog">
          <h2>Select a Necklace</h2>
          <div className="necklace-list">
            {NECKLACES.map((necklace, idx) => (
              <img
                key={necklace.src}
                src={necklace.src}
                alt={`Necklace ${idx + 1}`}
                className={selectedNecklace === necklace.src ? 'selected' : ''}
                onClick={() => setSelectedNecklace(necklace.src)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
