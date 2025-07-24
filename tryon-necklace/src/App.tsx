import React, { useRef, useState, useEffect } from 'react';
import './App.css';
import { FaceMesh } from '@mediapipe/face_mesh';

// Placeholder necklace images (add your own in public/necklaces/)
const NECKLACES = [
  '/necklaces/necklace1.png',
  '/necklaces/necklace2.png',
  '/necklaces/necklace3.png',
];

function App() {
  const [photo, setPhoto] = useState<string | null>(null);
  const [selectedNecklace, setSelectedNecklace] = useState<string | null>(null);
  const [landmarks, setLandmarks] = useState<any>(null);
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

  // Run MediaPipe Face Mesh on the uploaded photo
  useEffect(() => {
    if (!photo || !imgRef.current) return;
    const img = imgRef.current;
    if (!img.complete) return;

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

    const runFaceMesh = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      await faceMesh.send({ image: canvas });
    };
    runFaceMesh();
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
      const necklaceImg = new window.Image();
      necklaceImg.src = selectedNecklace;
      necklaceImg.onload = () => {
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
      };
    }
  }, [photo, landmarks, selectedNecklace]);

  return (
    <div className="App">
      <h1>CKC Jewellery Try-On</h1>
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
        </div>
      )}
      <div className="necklace-catalog">
        <h2>Select a Necklace</h2>
        <div className="necklace-list">
          {NECKLACES.map((src, idx) => (
            <img
              key={src}
              src={src}
              alt={`Necklace ${idx + 1}`}
              className={selectedNecklace === src ? 'selected' : ''}
              onClick={() => setSelectedNecklace(src)}
              style={{ width: 100, height: 60, margin: 8, cursor: 'pointer', border: selectedNecklace === src ? '2px solid #61dafb' : '2px solid transparent' }}
            />
          ))}
        </div>
      </div>
      {/* TODO: Add download/share button */}
    </div>
  );
}

export default App;
