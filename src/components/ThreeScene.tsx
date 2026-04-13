'use client';

import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sphere, MeshDistortMaterial, MeshWobbleMaterial, PresentationControls, Environment, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

interface SceneProps {
  theme: 'nebula' | 'cyber' | 'flow' | 'retro' | 'aurora' | 'royal';
}

const FloatingObject = ({ color, position, speed, size, type }: { color: string, position: [number, number, number], speed: number, size: number, type: 'distort' | 'wobble' | 'standard' }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime() * speed;
    meshRef.current.position.y = position[1] + Math.sin(t) * 0.5;
    meshRef.current.rotation.x = t * 0.2;
    meshRef.current.rotation.y = t * 0.3;
  });

  return (
    <Float speed={speed * 2} rotationIntensity={1} floatIntensity={2}>
      <Sphere ref={meshRef} position={position} args={[size, 64, 64]}>
        {type === 'distort' && (
          <MeshDistortMaterial
            color={color}
            speed={speed * 3}
            distort={0.4}
            radius={size}
          />
        )}
        {type === 'wobble' && (
          <MeshWobbleMaterial
            color={color}
            speed={speed * 4}
            factor={0.6}
          />
        )}
        {type === 'standard' && (
          <meshStandardMaterial
            color={color}
            roughness={0.1}
            metalness={0.8}
          />
        )}
      </Sphere>
    </Float>
  );
};

const NebulaObjects = () => (
  <>
    <FloatingObject color="#A91079" position={[-4, 2, -2]} speed={0.5} size={1.2} type="distort" />
    <FloatingObject color="#2E0249" position={[4, -2, -3]} speed={0.8} size={0.8} type="wobble" />
    <FloatingObject color="#570A57" position={[0, -4, -5]} speed={0.3} size={2} type="distort" />
  </>
);

const CyberObjects = () => (
  <>
    <FloatingObject color="#39FF14" position={[-5, 3, -4]} speed={1.2} size={0.5} type="wobble" />
    <FloatingObject color="#00FFFF" position={[5, -1, -2]} speed={1.5} size={0.4} type="distort" />
    <FloatingObject color="#111" position={[0, 2, -6]} speed={0.5} size={3} type="standard" />
  </>
);

const FlowObjects = () => (
  <>
    <FloatingObject color="#C0C0C0" position={[-3, -2, -3]} speed={0.4} size={1.5} type="distort" />
    <FloatingObject color="#FFD700" position={[2, 3, -1]} speed={0.6} size={0.6} type="distort" />
    <FloatingObject color="#E6E6FA" position={[-1, 1, -4]} speed={0.2} size={1} type="distort" />
  </>
);

const RetroObjects = () => (
  <>
    <FloatingObject color="#FF4500" position={[-6, 0, -5]} speed={1} size={1} type="wobble" />
    <FloatingObject color="#4B0082" position={[6, 2, -4]} speed={0.7} size={0.8} type="standard" />
    <FloatingObject color="#008080" position={[0, -3, -3]} speed={0.9} size={1.2} type="distort" />
  </>
);

const AuroraObjects = () => (
  <>
    <FloatingObject color="#F0F8FF" position={[-4, 4, -6]} speed={0.3} size={2.5} type="distort" />
    <FloatingObject color="#87CEEB" position={[4, -3, -2]} speed={0.5} size={0.5} type="wobble" />
    <FloatingObject color="#FFFACD" position={[-2, -2, -4]} speed={0.2} size={0.9} type="distort" />
  </>
);

const RoyalObjects = () => (
  <>
    <FloatingObject color="#8B0000" position={[-3, 1, -2]} speed={0.6} size={0.7} type="standard" />
    <FloatingObject color="#FFD700" position={[3, 3, -5]} speed={0.4} size={1.1} type="standard" />
    <FloatingObject color="#000080" position={[0, -2, -3]} speed={0.8} size={0.4} type="wobble" />
  </>
);

export default function ThreeScene({ theme }: SceneProps) {
  return (
    <div className="absolute inset-0 -z-10 pointer-events-none">
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[0, 0, 10]} fov={50} />
        <ambientLight intensity={1.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={2} castShadow />
        <pointLight position={[-10, -10, -10]} intensity={1} />
        
        <PresentationControls
          global
          snap
          rotation={[0, 0, 0]}
          polar={[-Math.PI / 3, Math.PI / 3]}
          azimuth={[-Math.PI / 1.4, Math.PI / 1.4]}
        >
          {theme === 'nebula' && <NebulaObjects />}
          {theme === 'cyber' && <CyberObjects />}
          {theme === 'flow' && <FlowObjects />}
          {theme === 'retro' && <RetroObjects />}
          {theme === 'aurora' && <AuroraObjects />}
          {theme === 'royal' && <RoyalObjects />}
        </PresentationControls>

        <Environment preset="city" />
      </Canvas>
    </div>
  );
}
