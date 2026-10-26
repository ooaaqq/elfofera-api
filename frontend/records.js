import { z } from "zod";
import { members } from "./members.js";

export const memberSchema = z.enum(Object.keys(members));
export const dateSchema = z.iso.date();
