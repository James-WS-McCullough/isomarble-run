"use client";

import { OrthographicCamera } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

const MIN_ZOOM = 15;
const MAX_ZOOM = 160;
/** Camera sits this far back along the isometric view direction */
const DISTANCE = 60;
const VIEW = new THREE.Vector3(1, 1, 1).normalize();

/**
 * A fixed isometric camera. Scroll to zoom; drag with the middle mouse
 * button (or hold Shift and drag) to pan; arrow keys also pan.
 */
export function CameraRig() {
  const { gl, size } = useThree();
  const camera = useRef<THREE.OrthographicCamera>(null);
  const target = useRef(new THREE.Vector3(0, 0, 0));

  // Start at a comfortable zoom once the canvas has its real size
  const fitted = useRef(false);
  useEffect(() => {
    const cam = camera.current;
    if (!cam || fitted.current || size.width < 200 || size.height < 200) return;
    fitted.current = true;
    cam.zoom = Math.min(
      Math.max(Math.min(size.width, size.height) / 13, MIN_ZOOM),
      MAX_ZOOM,
    );
    cam.updateProjectionMatrix();
  }, [size.width, size.height]);

  // Pointer and keyboard listeners, set up once
  useEffect(() => {
    const element = gl.domElement;
    const cam = camera.current;
    if (!cam) return;

    const place = () => {
      cam.position.copy(target.current).addScaledVector(VIEW, DISTANCE);
      cam.lookAt(target.current);
      cam.updateMatrixWorld();
    };
    place();

    const pan = (dxPixels: number, dyPixels: number) => {
      const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
      target.current
        .addScaledVector(right, -dxPixels / cam.zoom)
        .addScaledVector(up, dyPixels / cam.zoom);
      place();
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = Math.exp(-event.deltaY * 0.0015);
      cam.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cam.zoom * factor));
      cam.updateProjectionMatrix();
    };

    let dragging = false;
    let last = { x: 0, y: 0 };
    const onPointerDown = (event: PointerEvent) => {
      if (event.button === 1 || (event.button === 0 && event.shiftKey)) {
        dragging = true;
        last = { x: event.clientX, y: event.clientY };
        element.setPointerCapture(event.pointerId);
        event.preventDefault();
      }
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      pan(event.clientX - last.x, event.clientY - last.y);
      last = { x: event.clientX, y: event.clientY };
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      element.releasePointerCapture(event.pointerId);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      const step = 40;
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [step, 0],
        ArrowRight: [-step, 0],
        ArrowUp: [0, step],
        ArrowDown: [0, -step],
      };
      const move = moves[event.key];
      if (move) {
        event.preventDefault();
        pan(move[0], move[1]);
      }
    };

    element.addEventListener("wheel", onWheel, { passive: false });
    element.addEventListener("pointerdown", onPointerDown);
    element.addEventListener("pointermove", onPointerMove);
    element.addEventListener("pointerup", onPointerUp);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [gl]);

  return <OrthographicCamera ref={camera} makeDefault near={0.1} far={200} />;
}
