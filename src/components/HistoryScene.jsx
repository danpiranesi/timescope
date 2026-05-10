import React from 'react';
import { Text } from '@react-three/drei';

const SAMPLE_EVENTS = [
  { year: 1490, label: 'Komoro Castle constructed', position: [0, 0.5, -2] },
  { year: 1600, label: 'Sengoku period — castle fortified under Sengoku Tadamasa', position: [1, 0.5, -2.5] },
  { year: 1742, label: 'Great flood devastates the Chikuma River valley', position: [-1, 0.5, -2] },
  { year: 1870, label: 'Meiji era — feudal domains abolished, Komoro modernizes', position: [0.5, 0.5, -3] },
  { year: 1890, label: 'Shimazaki Toson lives in Komoro, writes literary works', position: [-0.5, 0.5, -1.5] },
  { year: 1910, label: 'Shinano Railway reaches Komoro Station', position: [0, 0.5, -2.5] },
  { year: 1950, label: 'Post-war rebuilding and agricultural revival', position: [1, 0.5, -1.5] },
  { year: 2000, label: 'Kaikoen Park restoration and tourism growth', position: [-1, 0.5, -3] },
];

export default function HistoryScene({ year }) {
  const visibleEvents = SAMPLE_EVENTS.filter((e) => e.year <= year);

  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 5, 5]} />
      {visibleEvents.map((event) => (
        <group key={event.year} position={event.position}>
          <mesh>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshStandardMaterial color="#4a90d9" />
          </mesh>
          <Text
            position={[0, 0.15, 0]}
            fontSize={0.06}
            color="white"
            anchorX="center"
            anchorY="bottom"
          >
            {`${event.year}: ${event.label}`}
          </Text>
        </group>
      ))}
    </>
  );
}
