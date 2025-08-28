"use client";

import { useRef, useCallback, useEffect } from "react";

interface MarbleState {
  id: string;
  state: "rolling" | "falling" | "behind";
  prevState?: "rolling" | "falling" | "behind";
}

interface SoundManager {
  updateMarbles: (marbles: MarbleState[]) => void;
  setEnabled: (enabled: boolean) => void;
  enabled: boolean;
}

interface RollingAudioData {
  audio: HTMLAudioElement;
  onEnded: () => void;
  onCanPlay: () => void;
}

export function useSoundManager(enabled: boolean = false): SoundManager {
  const marbleTapRef = useRef<HTMLAudioElement | null>(null);
  const rollingAudiosRef = useRef<Map<string, RollingAudioData>>(new Map());
  const enabledRef = useRef(enabled);
  const previousMarblesRef = useRef<Map<string, MarbleState>>(new Map());

  // Initialize audio objects
  useEffect(() => {
    // Create marble tap audio (one-shot sound)
    marbleTapRef.current = new Audio("/audio/MarbleTap.ogg");
    marbleTapRef.current.preload = "auto";
    marbleTapRef.current.volume = 0.6;

    return () => {
      // Cleanup on unmount
      if (marbleTapRef.current) {
        marbleTapRef.current.pause();
        marbleTapRef.current = null;
      }

      // Stop and cleanup all rolling sounds
      rollingAudiosRef.current.forEach(({ audio, onEnded, onCanPlay }) => {
        audio.removeEventListener("ended", onEnded);
        audio.removeEventListener("canplaythrough", onCanPlay);
        audio.pause();
        audio.currentTime = 0;
      });
      rollingAudiosRef.current.clear();
    };
  }, []);

  // Update enabled state
  useEffect(() => {
    enabledRef.current = enabled;

    // If disabled, stop all sounds immediately
    if (!enabled) {
      if (marbleTapRef.current) {
        marbleTapRef.current.pause();
        marbleTapRef.current.currentTime = 0;
      }

      rollingAudiosRef.current.forEach(({ audio, onEnded, onCanPlay }) => {
        audio.removeEventListener("ended", onEnded);
        audio.removeEventListener("canplaythrough", onCanPlay);
        audio.pause();
        audio.currentTime = 0;
      });
      rollingAudiosRef.current.clear();
    }
  }, [enabled]);

  const playMarbleTap = useCallback(() => {
    if (!enabledRef.current || !marbleTapRef.current) return;

    try {
      // Add random pitch variance (±10%)
      const pitchVariance = 0.8 + Math.random() * 1.2; // Range: 0.9 to 1.1
      marbleTapRef.current.playbackRate = pitchVariance;

      // Debug: Log the pitch variance being applied
      console.log(
        `Playing marble tap at ${(pitchVariance * 100).toFixed(1)}% speed/pitch`
      );

      // Reset to beginning and play
      marbleTapRef.current.currentTime = 0;
      marbleTapRef.current.play().catch(console.warn);
    } catch (error) {
      console.warn("Failed to play marble tap sound:", error);
    }
  }, []);

  const startMarbleRoll = useCallback((marbleId: string) => {
    if (!enabledRef.current) return;

    // Don't create duplicate rolling sounds for the same marble
    if (rollingAudiosRef.current.has(marbleId)) {
      return;
    }

    try {
      const audio = new Audio("/audio/MarbleRoll.ogg");
      audio.preload = "auto";
      audio.loop = true;
      audio.volume = 0.4;

      // Add random pitch variance (±10%) - each marble gets its own consistent pitch
      const pitchVariance = 0.9 + Math.random() * 0.2; // Range: 0.9 to 1.1
      audio.playbackRate = pitchVariance;

      // Debug: Log the pitch variance being applied
      console.log(
        `Starting marble roll sound for ${marbleId} at ${(
          pitchVariance * 100
        ).toFixed(1)}% speed/pitch`
      );

      // Create event handlers with proper references for cleanup
      const onEnded = () => {
        if (rollingAudiosRef.current.has(marbleId)) {
          audio.currentTime = 0;
          audio.play().catch(console.warn);
        }
      };

      const onCanPlay = () => {
        if (rollingAudiosRef.current.has(marbleId) && enabledRef.current) {
          audio.play().catch(console.warn);
        }
      };

      // Add event listeners
      audio.addEventListener("ended", onEnded);
      audio.addEventListener("canplaythrough", onCanPlay);

      // Store audio data with event handlers for cleanup
      rollingAudiosRef.current.set(marbleId, {
        audio,
        onEnded,
        onCanPlay,
      });

      // Start playing once audio is loaded
      audio.play().catch(() => {
        // If immediate play fails, try again after a short delay
        setTimeout(() => {
          if (rollingAudiosRef.current.has(marbleId) && enabledRef.current) {
            audio.play().catch(console.warn);
          }
        }, 100);
      });
    } catch (error) {
      console.warn("Failed to start marble roll sound:", error);
    }
  }, []);

  const stopMarbleRoll = useCallback((marbleId: string) => {
    const audioData = rollingAudiosRef.current.get(marbleId);
    if (!audioData) return;

    const { audio, onEnded, onCanPlay } = audioData;

    try {
      // Remove event listeners first
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("canplaythrough", onCanPlay);

      // Stop and reset audio
      audio.pause();
      audio.currentTime = 0;

      // Remove from map
      rollingAudiosRef.current.delete(marbleId);
    } catch (error) {
      console.warn("Failed to stop marble roll sound:", error);
    }
  }, []);

  const updateMarbles = useCallback(
    (marbles: MarbleState[]) => {
      if (!enabledRef.current) return;

      const currentMarbles = new Map<string, MarbleState>();

      // Process each marble
      marbles.forEach((marble) => {
        currentMarbles.set(marble.id, marble);
        const previousMarble = previousMarblesRef.current.get(marble.id);

        // Check for state transitions
        const prevState = previousMarble?.state;
        const currentState = marble.state;

        // Play tap sound when transitioning from falling to rolling
        if (prevState === "falling" && currentState === "rolling") {
          playMarbleTap();
        }

        // Handle rolling sound
        if (currentState === "rolling" && prevState !== "rolling") {
          // Start rolling sound when entering rolling state
          startMarbleRoll(marble.id);
        } else if (currentState !== "rolling" && prevState === "rolling") {
          // Stop rolling sound when leaving rolling state
          stopMarbleRoll(marble.id);
        }
      });

      // Stop sounds for marbles that no longer exist
      previousMarblesRef.current.forEach((prevMarble, marbleId) => {
        if (!currentMarbles.has(marbleId)) {
          stopMarbleRoll(marbleId);
        }
      });

      // Update previous marbles reference
      previousMarblesRef.current = currentMarbles;
    },
    [playMarbleTap, startMarbleRoll, stopMarbleRoll]
  );

  const setEnabled = useCallback((newEnabled: boolean) => {
    enabledRef.current = newEnabled;

    if (!newEnabled) {
      // Stop all sounds when disabling
      if (marbleTapRef.current) {
        marbleTapRef.current.pause();
        marbleTapRef.current.currentTime = 0;
      }

      rollingAudiosRef.current.forEach(({ audio, onEnded, onCanPlay }) => {
        audio.removeEventListener("ended", onEnded);
        audio.removeEventListener("canplaythrough", onCanPlay);
        audio.pause();
        audio.currentTime = 0;
      });
      rollingAudiosRef.current.clear();
    }
  }, []);

  return {
    updateMarbles,
    setEnabled,
    enabled: enabledRef.current,
  };
}
