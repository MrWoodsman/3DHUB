import { useEffect, useLayoutEffect, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  GizmoHelper,
  GizmoViewport,
  Grid,
  Line,
  OrbitControls,
} from "@react-three/drei";
import * as THREE from "three";
import type { ModelFile } from "@shared/types";
import {
  loadModel,
  disposeObject,
  applyColorMode,
  hasColors,
} from "../lib/loadModel";

// Print-bed axes: X red, Y green, Z (height) blue. Three.js is Y-up, so print Y = -z and print Z = y.
const AXIS = { x: "#e5484d", y: "#46a758", z: "#3e8bff" };

/** Rounds to a "nice" grid step: 1, 2, 5 x 10^n. */
const niceStep = (v: number): number => {
  const p = 10 ** Math.floor(Math.log10(v));
  const m = v / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
};

function CameraRig({ size }: { size: THREE.Vector3 }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as {
    target: THREE.Vector3;
    update: () => void;
  } | null;
  const invalidate = useThree((s) => s.invalidate);

  useLayoutEffect(() => {
    const r = size.length() / 2 || 1;
    const dist = (r / Math.sin(THREE.MathUtils.degToRad(20))) * 1.05;
    camera.position.set(1, 0.75, 1.2).normalize().multiplyScalar(dist);
    camera.near = r / 100;
    camera.far = r * 100;
    camera.updateProjectionMatrix();
    controls?.target.set(0, size.y / 2, 0);
    controls?.update();
    invalidate();
  }, [size, camera, controls, invalidate]);

  return null;
}

function Bed({ size }: { size: THREE.Vector3 }) {
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const cell = niceStep(maxDim / 8);
  const bed = Math.max(size.x, size.z) * 2.6;
  const len = maxDim * 0.55;
  const o: [number, number, number] = [-size.x / 2, 0.02, size.z / 2]; // front-left corner of the model footprint

  return (
    <>
      <Grid
        position={[0, -0.02, 0]}
        args={[bed, bed]}
        cellSize={cell}
        sectionSize={cell * 5}
        cellColor="#262b32"
        sectionColor="#39414b"
        cellThickness={0.7}
        sectionThickness={1.1}
        fadeDistance={bed * 1.1}
        fadeStrength={1.6}
        infiniteGrid={false}
      />
      <Line
        points={[o, [o[0] + len, o[1], o[2]]]}
        color={AXIS.x}
        lineWidth={2.5}
      />
      <Line
        points={[o, [o[0], o[1], o[2] - len]]}
        color={AXIS.y}
        lineWidth={2.5}
      />
      <Line
        points={[o, [o[0], o[1] + len, o[2]]]}
        color={AXIS.z}
        lineWidth={2.5}
      />
    </>
  );
}

/** Applies the color/solid choice to the loaded model and redraws (the canvas only renders on demand). */
function ColorMode({
  object,
  colored,
}: {
  object: THREE.Object3D;
  colored: boolean;
}) {
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    applyColorMode(object, colored);
    invalidate();
  }, [object, colored, invalidate]);
  return null;
}

function ColorToggle({
  colored,
  onChange,
}: {
  colored: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="absolute left-3 top-3 flex rounded-lg bg-bg/70 p-0.5 text-xs" title="Kolor lub jednolity (C)">
      {(
        [
          [true, "Kolor"],
          [false, "Jednolity"],
        ] as const
      ).map(([value, label]) => (
        <button
          key={label}
          onClick={() => onChange(value)}
          className={`rounded-md px-2.5 py-1 transition-colors ${colored === value ? "bg-hover text-text" : "text-muted hover:text-text"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Spinner({ visible }: { visible: boolean }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
    >
      <span className="h-7 w-7 animate-spin rounded-full border-2 border-line-strong border-t-accent" />
      <span className="text-xs text-muted">Ładowanie modelu…</span>
    </div>
  );
}

/** Orientation gizmo in the corner, in print coordinates (rotated because the scene is Y-up). */
function AxisGizmo() {
  return (
    <GizmoHelper alignment="bottom-right" margin={[52, 52]}>
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <GizmoViewport
          axisColors={[AXIS.x, AXIS.y, AXIS.z]}
          labels={["X", "Y", "Z"]}
          labelColor="#0c0d0f"
          hideNegativeAxes
          onClick={() => null}
        />
      </group>
    </GizmoHelper>
  );
}

export default function ModelViewer({
  model,
  onDimensions,
}: {
  model: ModelFile;
  onDimensions?: (d: THREE.Vector3) => void;
}) {
  const [object, setObject] = useState<THREE.Object3D | null>(null);
  const [size, setSize] = useState<THREE.Vector3 | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [colored, setColored] = useState(true)
  useEffect(() => {
    const toggle = () => setColored((c) => !c) // "C" is handled in the library
    window.addEventListener('hub:toggle-color', toggle)
    return () => window.removeEventListener('hub:toggle-color', toggle)
  }, []);

  useEffect(() => {
    let alive = true;
    let loaded: THREE.Object3D | null = null;
    setObject(null);
    setSize(null);
    setReady(false);
    setError(null);
    loadModel(model)
      .then((obj) => {
        if (!alive) return disposeObject(obj);
        loaded = obj;
        // stand the model on the bed, centered
        const box = new THREE.Box3().setFromObject(obj);
        const center = box.getCenter(new THREE.Vector3());
        obj.position.set(-center.x, -box.min.y, -center.z);
        const s = box.getSize(new THREE.Vector3());
        onDimensions?.(s);
        setObject(obj);
        setSize(s);
        // fade in after the first frame has been drawn
        requestAnimationFrame(() =>
          requestAnimationFrame(() => alive && setReady(true)),
        );
      })
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
      if (loaded) disposeObject(loaded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);

  if (error) return <div className="p-4 text-sm text-red-400">{error}</div>;

  return (
    <div className="absolute inset-0">
      <div
        className={`h-full transition-opacity duration-500 ${ready ? "opacity-100" : "opacity-0"}`}
      >
        <Canvas
          frameloop="demand"
          dpr={[1, 2]}
          camera={{ position: [120, 100, 120], fov: 40 }}
        >
          <hemisphereLight args={["#ffffff", "#3b3f52", 1.1]} />
          <directionalLight position={[50, 100, 50]} intensity={2} />
          {object && size && (
            <>
              <primitive object={object} />
              <ColorMode object={object} colored={colored} />
              <Bed size={size} />
              <CameraRig size={size} />
            </>
          )}
          <OrbitControls makeDefault enableDamping={false} />
          <AxisGizmo />
        </Canvas>
      </div>
      <Spinner visible={!ready} />
      {ready && object && hasColors(object) && (
        <ColorToggle colored={colored} onChange={setColored} />
      )}
    </div>
  );
}
