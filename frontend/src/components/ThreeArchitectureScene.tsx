import React, { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';

export interface ArchitectureNodeInfo {
  id: string;
  name: string;
  category: 'layer' | 'service' | 'contract' | 'adapter' | 'backend';
  subtitle: string;
  description: string;
  responsibilities: string[];
}

interface ThreeArchitectureSceneProps {
  currentProvider: string;
  isTechnicalView: boolean;
  activePacketStep: number | null; // 0: App, 1: FastAPI, 2: CacheService, 3: CacheProvider, 4: Adapter, 5: Backend, 6: Return
  packetStatusText: string | null;
  selectedNodeId: string | null;
  onSelectNode: (node: ArchitectureNodeInfo) => void;
  onResetCameraRef?: (resetFn: () => void) => void;
}

export const NODE_DEFINITIONS: Record<string, ArchitectureNodeInfo> = {
  app: {
    id: 'app',
    name: 'Application Layer',
    category: 'layer',
    subtitle: 'Uses one stable cache API',
    description: 'The consumer application (e.g. E-Commerce product catalog or user session store) that issues cache queries without any vendor-specific knowledge.',
    responsibilities: [
      'Issues standard get(), set(), and delete() calls',
      'Zero awareness of Redis vs. Memcached wire protocols',
      'Requires zero code changes during backend migrations',
    ],
  },
  fastapi: {
    id: 'fastapi',
    name: 'FastAPI REST Layer',
    category: 'layer',
    subtitle: 'HTTP / API boundary',
    description: 'Exposes HTTP endpoints (/cache/{key}, /health, /cache/metrics, /cache/switch) and handles HTTP serialization and error status codes.',
    responsibilities: [
      'Translates HTTP requests into cache operations',
      'Maps CacheValidationError to HTTP 422',
      'Maps CacheConnectionError to HTTP 503',
      'Handles reference-counted request draining on backend switches',
    ],
  },
  service: {
    id: 'service',
    name: 'CacheService (Core Abstraction)',
    category: 'service',
    subtitle: 'Stable application-facing contract',
    description: 'The primary abstraction coordinator. Encapsulates UTF-8 key validation, type-preserving serialization, TTL translation, and namespace isolation.',
    responsibilities: [
      'Disambiguates Cached None (HTTP 200) from Cache Miss (HTTP 404)',
      'Translates TTL durations >30 days to Unix timestamps for Memcached',
      'Enforces UTF-8 key byte length <= 250 bytes without control characters',
      'Delegates namespace-safe clear operations',
      'Measures execution latency and hit ratios for telemetry',
    ],
  },
  provider: {
    id: 'provider',
    name: 'CacheProvider Interface (ABC)',
    category: 'contract',
    subtitle: 'Common provider contract interface',
    description: 'Abstract Base Class defining the universal pluggable contract: get(), set(), delete(), exists(), clear(), health_check(), and close().',
    responsibilities: [
      'Defines the public contract implemented by all backend adapters',
      'Enables polymorphic plug-and-play adapter registration',
      'Guarantees identical behavior across interchangeable backends',
    ],
  },
  redis_adapter: {
    id: 'redis_adapter',
    name: 'RedisAdapter',
    category: 'adapter',
    subtitle: 'Redis-specific driver implementation',
    description: 'Maps the CacheProvider contract to redis-py using managed connection pooling and pipeline operations.',
    responsibilities: [
      'Maintains redis.ConnectionPool for thread-safe socket reuse',
      'Executes SCAN pattern-based batch deletions on namespace clear',
      'Normalizes Redis ConnectionError and TimeoutError into domain exceptions',
    ],
  },
  redis_backend: {
    id: 'redis_backend',
    name: 'Redis Server (Physical Backend)',
    category: 'backend',
    subtitle: 'In-Memory Data Structure Store',
    description: 'Real Redis instance running on port 6379, providing sub-millisecond in-memory key-value caching.',
    responsibilities: [
      'Stores physical byte string values and TTL timers',
      'Provides high throughput and persistence options',
    ],
  },
  memcached_adapter: {
    id: 'memcached_adapter',
    name: 'MemcachedAdapter',
    category: 'adapter',
    subtitle: 'Memcached-specific driver implementation',
    description: 'Maps the CacheProvider contract to pymemcache using pooled clients and namespace epoch versioning.',
    responsibilities: [
      'Maintains pymemcache.client.base.PooledClient connection pool',
      'Implements O(1) namespace clearing via epoch versioning (_ns_ver:<ns>)',
      'Translates relative TTLs >30 days to absolute Unix epoch timestamps',
      'Normalizes MemcachedSocketError and MemcachedError into domain exceptions',
    ],
  },
  memcached_backend: {
    id: 'memcached_backend',
    name: 'Memcached Server (Physical Backend)',
    category: 'backend',
    subtitle: 'Distributed Memory Object Caching System',
    description: 'Real Memcached instance running on port 11211, providing lightweight high-speed memory caching.',
    responsibilities: [
      'Stores in-memory slab allocations with LRU eviction',
      'Fast memory access with minimal server-side overhead',
    ],
  },
};

export const ThreeArchitectureScene: React.FC<ThreeArchitectureSceneProps> = ({
  currentProvider,
  isTechnicalView,
  activePacketStep,
  packetStatusText,
  selectedNodeId,
  onSelectNode,
  onResetCameraRef,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshesMapRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const packetMeshRef = useRef<THREE.Mesh | null>(null);
  const animationFrameIdRef = useRef<number>(0);

  const isRedisActive = currentProvider.toLowerCase() === 'redis';

  // Helper to create sharp text sprite label
  const createTextTexture = (title: string, sub: string, highlightColor: string = '#ffffff') => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    // Background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.roundRect(10, 10, 492, 140, 16);
    ctx.fill();
    ctx.strokeStyle = highlightColor;
    ctx.lineWidth = 4;
    ctx.stroke();

    // Title
    ctx.font = 'bold 36px Inter, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(title, 256, 68);

    // Subtitle
    ctx.font = '500 24px Inter, sans-serif';
    ctx.fillStyle = highlightColor;
    ctx.fillText(sub, 256, 115);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    return texture;
  };

  // Reset Camera View
  const resetCamera = useCallback(() => {
    if (cameraRef.current) {
      cameraRef.current.position.set(0, 0, 14);
      cameraRef.current.lookAt(0, 0, 0);
    }
  }, []);

  useEffect(() => {
    if (onResetCameraRef) {
      onResetCameraRef(resetCamera);
    }
  }, [onResetCameraRef, resetCamera]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene & Camera Setup
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 550;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090d16);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 14);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;
    container.replaceChildren(renderer.domElement);

    // 2. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0xffffff, 0.8, 50);
    pointLight.position.set(0, 0, 10);
    scene.add(pointLight);

    // 3. Create Node Meshes
    const meshesMap = new Map<string, THREE.Mesh>();
    meshesMapRef.current = meshesMap;

    // Helper to create a 3D Node Block with Sprite Label
    const createNodeMesh = (
      id: string,
      title: string,
      sub: string,
      x: number,
      y: number,
      w: number,
      h: number,
      color: number,
      glowColor: string
    ) => {
      const geom = new THREE.BoxGeometry(w, h, 0.5);
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.3,
        metalness: 0.2,
        emissive: color,
        emissiveIntensity: 0.15,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(x, y, 0);
      mesh.userData = { id };
      scene.add(mesh);
      meshesMap.set(id, mesh);

      // Label Sprite
      const spriteMat = new THREE.SpriteMaterial({
        map: createTextTexture(title, sub, glowColor),
        transparent: true,
      });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(w * 1.1, h * 0.9, 1);
      sprite.position.set(x, y, 0.35);
      scene.add(sprite);

      return mesh;
    };

    // Node 1: Application (Top)
    createNodeMesh('app', 'APPLICATION', 'Uses stable cache API', 0, 4.4, 4.2, 1.1, 0x1e3a8a, '#60a5fa');

    // Node 2: FastAPI
    createNodeMesh('fastapi', 'FASTAPI REST', 'HTTP Boundary', 0, 2.8, 3.8, 1.0, 0x312e81, '#818cf8');

    // Node 3: CacheService (Hero Node - Largest & Most Prominent)
    createNodeMesh('service', 'CACHE SERVICE', 'Core Abstraction Layer', 0, 1.0, 5.2, 1.4, 0x1d4ed8, '#38bdf8');

    // Node 4: CacheProvider Interface
    createNodeMesh('provider', 'CACHE PROVIDER (ABC)', 'Common Contract Interface', 0, -0.8, 4.6, 1.1, 0x0f766e, '#2dd4bf');

    // Redis Branch (Left)
    createNodeMesh('redis_adapter', 'RedisAdapter', 'Pooled Connection', -3.4, -2.4, 2.8, 1.0, 0x7f1d1d, '#f87171');
    createNodeMesh('redis_backend', 'REDIS BACKEND', 'Port 6379', -3.4, -4.0, 2.8, 1.1, 0x991b1b, '#ef4444');

    // Memcached Branch (Right)
    createNodeMesh('memcached_adapter', 'MemcachedAdapter', 'Epoch Versioning', 3.4, -2.4, 2.8, 1.0, 0x164e63, '#22d3ee');
    createNodeMesh('memcached_backend', 'MEMCACHED BACKEND', 'Port 11211', 3.4, -4.0, 2.8, 1.1, 0x155e75, '#06b6d4');

    // 4. Connection Lines
    const lineMatActive = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 });
    const lineMatDim = new THREE.LineBasicMaterial({ color: 0x334155, linewidth: 1 });

    const addConnection = (p1: [number, number], p2: [number, number], isActive: boolean) => {
      const points = [new THREE.Vector3(p1[0], p1[1], -0.1), new THREE.Vector3(p2[0], p2[1], -0.1)];
      const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(lineGeom, isActive ? lineMatActive : lineMatDim);
      scene.add(line);
    };

    addConnection([0, 4.4], [0, 2.8], true);
    addConnection([0, 2.8], [0, 1.0], true);
    addConnection([0, 1.0], [0, -0.8], true);
    addConnection([0, -0.8], [-3.4, -2.4], isRedisActive);
    addConnection([-3.4, -2.4], [-3.4, -4.0], isRedisActive);
    addConnection([0, -0.8], [3.4, -2.4], !isRedisActive);
    addConnection([3.4, -2.4], [3.4, -4.0], !isRedisActive);

    // 5. Animated Data Packet
    const packetGeom = new THREE.SphereGeometry(0.25, 16, 16);
    const packetMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const packetMesh = new THREE.Mesh(packetGeom, packetMat);
    packetMesh.visible = false;
    scene.add(packetMesh);
    packetMeshRef.current = packetMesh;

    // 6. Interactive Raycaster for Clicks & Hover
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleClick = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(Array.from(meshesMap.values()));

      if (intersects.length > 0) {
        const hitId = intersects[0].object.userData.id;
        if (hitId && NODE_DEFINITIONS[hitId]) {
          onSelectNode(NODE_DEFINITIONS[hitId]);
        }
      }
    };

    container.addEventListener('click', handleClick);

    // 7. Mouse Drag Rotation Controls
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      scene.rotation.y += deltaX * 0.005;
      scene.rotation.x += deltaY * 0.005;

      // Bound rotation
      scene.rotation.x = Math.max(-0.4, Math.min(0.4, scene.rotation.x));
      scene.rotation.y = Math.max(-0.6, Math.min(0.6, scene.rotation.y));

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      camera.position.z = Math.max(8, Math.min(20, camera.position.z + e.deltaY * 0.01));
    };

    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('wheel', handleWheel, { passive: false });

    // 8. Render Animation Loop
    let clock = new THREE.Clock();
    const animate = () => {
      animationFrameIdRef.current = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Subtle gentle breathing pulse on CacheService hero node
      const serviceMesh = meshesMap.get('service');
      if (serviceMesh) {
        serviceMesh.position.z = Math.sin(elapsedTime * 2) * 0.08;
      }

      // Highlight selected node
      if (selectedNodeId && meshesMap.has(selectedNodeId)) {
        const selectedMesh = meshesMap.get(selectedNodeId);
        if (selectedMesh) {
          selectedMesh.scale.set(1.05, 1.05, 1.05);
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    // 9. Resize handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('click', handleClick);
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('wheel', handleWheel);
      cancelAnimationFrame(animationFrameIdRef.current);
      renderer.dispose();
    };
  }, [onSelectNode, isRedisActive, isTechnicalView]);

  // Handle active packet animation step
  useEffect(() => {
    const packet = packetMeshRef.current;
    if (!packet) return;

    if (activePacketStep === null) {
      packet.visible = false;
      return;
    }

    packet.visible = true;
    const targetX = isRedisActive ? -3.4 : 3.4;

    switch (activePacketStep) {
      case 0: // App
        packet.position.set(0, 4.4, 0.6);
        break;
      case 1: // FastAPI
        packet.position.set(0, 2.8, 0.6);
        break;
      case 2: // CacheService
        packet.position.set(0, 1.0, 0.8);
        break;
      case 3: // CacheProvider
        packet.position.set(0, -0.8, 0.6);
        break;
      case 4: // Adapter
        packet.position.set(targetX, -2.4, 0.6);
        break;
      case 5: // Backend
        packet.position.set(targetX, -4.0, 0.6);
        break;
      case 6: // Return to App (Success)
        packet.position.set(0, 4.4, 0.6);
        break;
    }
  }, [activePacketStep, isRedisActive]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '520px', borderRadius: '12px', overflow: 'hidden' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%', cursor: 'grab' }} />

      {/* Real-Time Packet Status Overlay */}
      {packetStatusText && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid var(--accent-blue)',
          padding: '0.5rem 1.25rem',
          borderRadius: '9999px',
          color: '#38bdf8',
          fontWeight: 700,
          fontSize: '0.85rem',
          boxShadow: '0 0 20px rgba(56, 189, 248, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          pointerEvents: 'none'
        }}>
          <span className="status-dot switching"></span>
          <span>{packetStatusText}</span>
        </div>
      )}

      {/* Click Hint Overlay */}
      <div style={{
        position: 'absolute',
        top: '12px',
        right: '12px',
        background: 'rgba(15, 23, 42, 0.8)',
        border: '1px solid var(--border-color)',
        padding: '0.3rem 0.6rem',
        borderRadius: '6px',
        color: 'var(--text-dim)',
        fontSize: '0.7rem',
        pointerEvents: 'none'
      }}>
        💡 Click nodes to inspect • Drag to rotate
      </div>
    </div>
  );
};
