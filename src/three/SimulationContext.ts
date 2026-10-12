import { createContext } from "react";
import type { Simulation } from "@/lib/simulation";

/** The running simulation, so moving parts like seesaws can follow it */
export const SimulationContext = createContext<Simulation | null>(null);
