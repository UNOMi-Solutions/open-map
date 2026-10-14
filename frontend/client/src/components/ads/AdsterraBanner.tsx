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
  const options = JSON.stringify({
    key: id,
    format: "iframe",
    height,
    width,
    params: {},
  });

  const srcDoc = `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="referrer" content="strict-origin-when-cross-origin">
    <style>html, body { width: ${width}px; height: ${height}px; margin: 0; overflow: hidden; }</style>
  </head>
  <body>
    <script>atOptions = ${options};</script>
    <script src="https://bauval.org/22/${encodeURIComponent(id)}"></script>
  </body>
</html>`;

  return (
    <div
      className="adsterra-banner-container"
      style={{
        display: "block",
        flex: "0 0 auto",
        width,
        height,
        margin: 0,
        overflow: "hidden",
      }}
    >
      <iframe
        title={`Adsterra banner ${id}`}
        srcDoc={srcDoc}
        width={width}
        height={height}
        referrerPolicy="strict-origin-when-cross-origin"
        scrolling="no"
        frameBorder="0"
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
        style={{
          display: "block",
          width,
          height,
          border: 0,
        }}
      />
    </div>
  );
}
