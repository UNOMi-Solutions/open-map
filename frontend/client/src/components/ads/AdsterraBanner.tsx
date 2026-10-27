import { useEffect, useRef } from "react";

declare global {
  interface Window {
    atOptions?: {
      key: string;
      format: "iframe";
      height: number;
      width: number;
      params: Record<string, never>;
    };
  }
}

type AdsterraBannerProps = {
  id: string;
  width?: number;
  height?: number;
};

export default function AdsterraBanner({
  id,
  width = 320,
  height = 50,
}: AdsterraBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    window.atOptions = {
      key: id,
      format: "iframe",
      height,
      width,
      params: {},
    };

    const script = document.createElement("script");
    script.src = `https://bauval.org/22/${encodeURIComponent(id)}`;
    script.async = false;
    container.appendChild(script);

    return () => {
      container.replaceChildren();
    };
  }, [height, id, width]);

  return (
    <div
      ref={containerRef}
      className="adsterra-banner-container"
      style={{
        display: "block",
        flex: "0 0 auto",
        width,
        height,
        margin: 0,
        overflow: "hidden",
      }}
    />
  );
}
