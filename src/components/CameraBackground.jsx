import React, { useEffect, useRef } from 'react';

export default function CameraBackground() {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((stream) => {
        video.srcObject = stream;
        video.play();
      })
      .catch((err) => console.warn('Camera not available:', err));

    return () => {
      if (video.srcObject) {
        video.srcObject.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return (
    <video
      ref={videoRef}
      playsInline
      muted
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        zIndex: -1,
      }}
    />
  );
}
