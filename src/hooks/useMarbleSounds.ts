"use client";

import { useEffect, useRef } from "react";
import { assetPath } from "@/lib/assets";
import type { MarbleStateType } from "@/lib/block-types";

interface SoundMarble {
  id: string;
  state: MarbleStateType;
}

const TAP_VOLUME = 0.6;
const ROLL_VOLUME = 0.4;

/** A random playback rate within ±10% so repeated sounds don't feel robotic */
function randomPitch(): number {
  return 0.9 + Math.random() * 0.2;
}

/**
 * Plays a tap when a marble lands on the track and a looping roll sound for
 * each marble while it is rolling.
 */
export function useMarbleSounds(marbles: SoundMarble[], enabled: boolean) {
  const tapRef = useRef<HTMLAudioElement | null>(null);
  const rollingRef = useRef(new Map<string, HTMLAudioElement>());
  const previousStatesRef = useRef(new Map<string, MarbleStateType>());

  useEffect(() => {
    if (!enabled) return;

    tapRef.current ??= new Audio(assetPath("/audio/MarbleTap.ogg"));
    const rolling = rollingRef.current;
    const previousStates = previousStatesRef.current;

    return () => {
      // Sound switched off (or unmounted): silence everything and forget
      // marble states so rolling marbles start their sound when re-enabled
      for (const audio of rolling.values()) audio.pause();
      rolling.clear();
      previousStates.clear();
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const rolling = rollingRef.current;
    const previousStates = previousStatesRef.current;
    const currentIds = new Set<string>();

    for (const marble of marbles) {
      currentIds.add(marble.id);
      const previous = previousStates.get(marble.id);
      previousStates.set(marble.id, marble.state);

      if (previous === "falling" && marble.state === "rolling") {
        playTap(tapRef.current);
      }

      if (marble.state === "rolling" && !rolling.has(marble.id)) {
        const audio = new Audio(assetPath("/audio/MarbleRoll.ogg"));
        audio.loop = true;
        audio.volume = ROLL_VOLUME;
        audio.playbackRate = randomPitch(); // Each marble keeps its own pitch
        audio.play().catch(() => {});
        rolling.set(marble.id, audio);
      } else if (marble.state !== "rolling") {
        stopRolling(rolling, marble.id);
      }
    }

    // Marbles that were removed
    for (const id of [...previousStates.keys()]) {
      if (!currentIds.has(id)) {
        stopRolling(rolling, id);
        previousStates.delete(id);
      }
    }
  }, [marbles, enabled]);
}

function playTap(source: HTMLAudioElement | null) {
  if (!source) return;
  // Play a copy so taps from several marbles can overlap
  const tap = source.cloneNode() as HTMLAudioElement;
  tap.volume = TAP_VOLUME;
  tap.playbackRate = randomPitch();
  tap.play().catch(() => {});
}

function stopRolling(rolling: Map<string, HTMLAudioElement>, id: string) {
  rolling.get(id)?.pause();
  rolling.delete(id);
}
