// src/Nebula.jsx
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * A pure three.js cosmic nebula:
 *  - A swirling starfield (Points)
 *  - A large plane with a custom "nebula" shader
 *  - Minimal overhead, no react-three-fiber or drei
 */

function Nebula() {
  const mountRef = useRef(null);

  useEffect(() => {
    let width = window.innerWidth;
    let height = window.innerHeight;
    let frameId;

    // SCENE + CAMERA
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 0, 8);

    // RENDERER
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);

    // STARFIELD (just an example)
    const starCount = 1000;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 40;   // x
      starPositions[i + 1] = (Math.random() - 0.5) * 40; // y
      starPositions[i + 2] = (Math.random() - 0.5) * 40; // z
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.3
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    // NEBULA PLANE (shader-based)
    // We'll create a big plane in front of the camera with a swirling color shader
    const planeGeometry = new THREE.PlaneGeometry(20, 20, 1, 1);
    const uniforms = {
      uTime: { value: 0 },
    };
    const nebulaMaterial = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;

        // A simple noise function or swirl effect
        float random(vec2 st) {
          return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
        }

        void main() {
          // swirl-like effect
          vec2 uv = vUv - 0.5;
          float dist = length(uv);
          float angle = atan(uv.y, uv.x);
          angle += uTime * 0.2; // swirl speed
          float swirl = sin(angle * 3.0 + dist * 10.0);
          
          vec3 color = mix(vec3(0.0, 0.0, 0.2), vec3(0.0, 1.0, 1.0), swirl * 0.5 + 0.5);
          // fade out edges
          float alpha = 1.0 - dist * 2.0;
          alpha = clamp(alpha, 0.0, 1.0);

          gl_FragColor = vec4(color, alpha * 0.8); 
        }
      `,
      transparent: true
    });
    const nebulaPlane = new THREE.Mesh(planeGeometry, nebulaMaterial);
    nebulaPlane.position.set(0,0,-5); // behind the stars
    scene.add(nebulaPlane);

    // RESIZE HANDLER
    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    // ANIMATE
    const animate = (time) => {
      uniforms.uTime.value = time * 0.001;

      // rotate the stars a bit
      stars.rotation.y += 0.0005;
      stars.rotation.x += 0.0003;

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);

    // CLEANUP
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
}

export default Nebula;
