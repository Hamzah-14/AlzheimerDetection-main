"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

const BASE_URL = "http://localhost:8000";

export interface NiivueViewerHandle {
  setSliceType: (type: "axial" | "coronal" | "sagittal") => void;
  setOpacity: (layer: number, opacity: number) => void;
}

interface NiivueViewerProps {
  jobId:           string;
  mode:            "brain" | "crop_L" | "crop_R";
  scanIndex?:      number;
  showHeatmap?:    boolean;
  heatmapOpacity?: number;
  showMask?:       boolean;
  maskOpacity?:    number;
  className?:      string;
}

type Status = "loading" | "loaded" | "error";

const NiivueViewer = forwardRef<NiivueViewerHandle, NiivueViewerProps>(
  function NiivueViewer(
    {
      jobId,
      mode,
      scanIndex = 0,
      showHeatmap = true,
      heatmapOpacity = 0.5,
      showMask = true,
      maskOpacity = 0.6,
      className,
    },
    ref,
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nvRef = useRef<any>(null);
    const [status, setStatus] = useState<Status>("loading");

    useImperativeHandle(ref, () => ({
      setSliceType: (type) => {
        const nv = nvRef.current;
        if (!nv) return;
        if (type === "axial")    nv.setSliceType(nv.sliceTypeAxial);
        if (type === "coronal")  nv.setSliceType(nv.sliceTypeCoronal);
        if (type === "sagittal") nv.setSliceType(nv.sliceTypeSagittal);
      },
      setOpacity: (layer, opacity) => {
        const nv = nvRef.current;
        if (!nv || !nv.volumes?.[layer]) return;
        nv.volumes[layer].opacity = opacity;
        nv.updateGLVolume();
      },
    }));

    useEffect(() => {
      if (typeof window === "undefined") return;
      let cancelled = false;

      async function init() {
        setStatus("loading");
        try {
          const { Niivue } = await import("@niivue/niivue");
          if (cancelled || !canvasRef.current) return;

          const nv = new Niivue({
            backColor:       [0.05, 0.05, 0.08, 1],
            show3Dcrosshair: true,
            isOrientCube:    true,
            isColorbar:      false,
            isAntiAlias:     false,
          });

          await nv.attachToCanvas(canvasRef.current);

          const volumes: { url: string; name: string; colormap: string; opacity: number }[] = [];

          if (mode === "brain") {
            volumes.push({
              url:      `${BASE_URL}/analyze/${jobId}/volume/brain/${scanIndex}`,
              name:     "brain.nii.gz",
              colormap: "gray",
              opacity:  1.0,
            });
            if (showMask) {
              volumes.push({
                url:      `${BASE_URL}/analyze/${jobId}/volume/hipp_mask`,
                name:     "hipp_mask.nii.gz",
                colormap: "hot",
                opacity:  maskOpacity,
              });
            }
          } else {
            const side = mode === "crop_L" ? "L" : "R";
            volumes.push({
              url:      `${BASE_URL}/analyze/${jobId}/volume/crop_${side}`,
              name:     `crop_${side}.nii.gz`,
              colormap: "gray",
              opacity:  1.0,
            });
            if (showHeatmap) {
              volumes.push({
                url:      `${BASE_URL}/analyze/${jobId}/volume/heatmap_${side}`,
                name:     `heatmap_${side}.nii.gz`,
                colormap: "hot",
                opacity:  heatmapOpacity,
              });
            }
          }

          await nv.loadVolumes(volumes);

          if (!cancelled) {
            nvRef.current = nv;
            setStatus("loaded");
          }
        } catch (err) {
          console.error("[NiiVue]", err);
          if (!cancelled) setStatus("error");
        }
      }

      init();
      return () => {
        cancelled = true;
        nvRef.current = null;
      };
    }, [jobId, mode, scanIndex, showHeatmap, showMask, maskOpacity, heatmapOpacity]);

    return (
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-[20px] border border-white/10 bg-black",
          "aspect-[1.1]",
          className,
        )}
      >
        {/* Loading */}
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center gap-3">
            <div className="h-5 w-5 animate-pulse rounded-full bg-white/15" />
            <span className="animate-pulse text-xs text-white/30">Loading volume---</span>
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xs text-red-400/70">Failed to load NIfTI volume</p>
          </div>
        )}

        <canvas
          ref={canvasRef}
          className={cn("h-full w-full", status !== "loaded" && "opacity-0")}
        />
      </div>
    );
  },
);

export default NiivueViewer;
