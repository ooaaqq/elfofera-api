import { z } from "zod";
import { dateSchema as date, memberSchema as member } from "./records";
export const manifestSchema = z.object({
  years: z.array(z.string().regex(/^\d{4}$/)).min(1),
  livestreams: z.array(
    z.object({
      id: z.string(),
      date,
      title: z.string(),
      members: z.array(member),
    }),
  ),
  works: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      artists: z.array(z.string()),
      kind: z.string(),
      series: z.string().nullable(),
      performanceCount: z.number().int().nonnegative(),
      publicationCount: z.number().int().nonnegative(),
    }),
  ),
  changes: z.array(
    z.object({
      date,
      action: z.string(),
      members: z.array(member),
      id: z.string(),
      description: z.string().min(1),
    }),
  ),
});
export const eventsSchema = z.array(
  z.object({
    id: z.string(),
    date,
    title: z.string(),
    contentType: z.string(),
    dimension: z.enum(["1d", "2d", "3d", "unknown"]),
    isUnannounced: z.boolean(),
    members: z.array(member),
    bvid: z.string().nullable(),
    videoParts: z.array(z.number().int().positive()),
    tracks: z.array(
      z.object({
        id: z.string(),
        workId: z.string(),
        title: z.string(),
        members: z.array(member),
        artists: z.array(z.string()),
        type: z.string(),
        bvid: z.string().nullable(),
        videoParts: z.array(z.number().int().positive()),
      }),
    ),
  }),
);

const historySchema = z.array(
  z.object({
    id: z.string(),
    eventId: z.string(),
    date: z.iso.date(),
    title: z.string(),
    kind: z.string(),
    members: z.array(member),
    type: z.string(),
    bvid: z.string().nullable(),
    videoParts: z.array(z.number().int().positive()),
  }),
);
export const detailsSchema = z.object({
  performances: historySchema,
  publications: z.array(
    z.object({
      id: z.string(),
      date: z.iso.date(),
      title: z.string(),
      members: z.array(member),
      bvid: z.string().nullable(),
      videoParts: z.array(z.number().int().positive()),
    }),
  ),
});

export const endpointsSchema = z.array(
  z.object({
    key: z.string().min(1),
    name: z.string().min(1),
    group: z.string(),
    results: z.array(
      z.object({
        success: z.boolean(),
        timestamp: z.iso.datetime({ offset: true }),
        duration: z.number().nonnegative(),
      }),
    ),
  }),
);

export type Manifest = z.infer<typeof manifestSchema>;
export type Livestream = Manifest["livestreams"][number];
export type Work = Manifest["works"][number];
export type ScheduleChange = Manifest["changes"][number];
export type ArchiveEvent = z.infer<typeof eventsSchema>[number];
export type WorkDetails = z.infer<typeof detailsSchema>;
export type Performance = WorkDetails["performances"][number];
export type Publication = WorkDetails["publications"][number];
export type Endpoint = z.infer<typeof endpointsSchema>[number];
