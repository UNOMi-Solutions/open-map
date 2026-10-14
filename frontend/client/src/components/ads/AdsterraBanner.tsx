type AdsterraBannerProps = {
  id: string;
  width?: number;
  height?: number;
};

export default function AdsterraBanner({
  id,
  width = 728,
  height = 90,
}: AdsterraBannerProps) {
  const options = JSON.stringify({
    key: id,
    format: "iframe",
    height,
    width,
    params: {},
  });
  const iframeContent = `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>html, body { margin: 0; padding: 0; overflow: hidden; }</style>
  </head>
  <body>
    <script>window.atOptions = ${options};</script>
    <script src="https://bauval.org/22/${encodeURIComponent(id)}"></script>
  </body>
</html>`;

  return (
    <div
      className="adsterra-banner-container"
      style={{
        display: "block",
        flex: "0 0 auto",
        boxSizing: "content-box",
        width,
        height,
        margin: "0 auto",
        overflow: "hidden",
      }}
    >
      <iframe
        title={`adsterra-ad-${id}`}
        srcDoc={iframeContent}
        width={width}
        height={height}
        scrolling="no"
        frameBorder="0"
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
        style={{
          display: "block",
          border: "none",
          width: "100%",
          height: "100%",
        }}
      />
    </div>
  );
}
