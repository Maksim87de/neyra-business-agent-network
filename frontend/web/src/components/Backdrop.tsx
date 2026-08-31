import { useGpuTier } from "@nous-research/ui/hooks/use-gpu-tier";

/**
 * Lightweight Neyra backdrop.
 *
 * The upstream DS filler image is intentionally not rendered here: first paint
 * must stay Neyra-only, and color mode changes should not reveal old artwork.
 *
 *   z-1   solid color-mode canvas
 *   z-2   optional user-provided CSS background asset, defaulting to none
 *   z-99  soft top-left vignette
 *   z-101 noise grain, gated on GPU tier
 *
 * `useGpuTier` returns 0 when WebGL is unavailable, the renderer is a
 * software rasterizer (SwiftShader/llvmpipe), or the user has
 * `prefers-reduced-motion: reduce` set. We skip the animated noise layer
 * in that case so low-power / accessibility-conscious sessions stay crisp,
 * mirroring the DS `<Noise />` component's own opt-out.
 */
export function Backdrop() {
  const gpuTier = useGpuTier();

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[1]"
        style={{
          backgroundColor: "var(--background-base)",
        }}
      />

      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[2]"
        style={
          {
            mixBlendMode:
              "var(--component-backdrop-filler-blend-mode, normal)",
            opacity: "var(--component-backdrop-filler-opacity, 0)",
            backgroundImage: "var(--theme-asset-bg, none)",
            backgroundSize: "var(--component-backdrop-background-size, cover)",
            backgroundPosition:
              "var(--component-backdrop-background-position, center)",
          } as unknown as React.CSSProperties
        }
      />

      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[99]"
        style={{
          background:
            "radial-gradient(ellipse at 0% 0%, transparent 60%, var(--warm-glow) 100%)",
          mixBlendMode: "lighten",
          opacity: 0.22,
        }}
      />

      {gpuTier > 0 && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[101]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' fill='%23eaeaea' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E\")",
            backgroundSize: "512px 512px",
            mixBlendMode: "color-dodge",
            opacity: "calc(0.55 * var(--noise-opacity-mul, 1))",
          }}
        />
      )}
    </>
  );
}
