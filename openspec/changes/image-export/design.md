# Design

- **One source.** `exportSvg(scene, options)` builds a string from the elements' draw lists and the connectors' looks, so the SVG, the PNG and the screen agree. It has no DOM dependency and runs in Node.
- **PNG** is drawn with the same painter as the screen on an offscreen canvas at the chosen scale; sizes over 16,384 pixels on a side are refused with a plain message.
- **PDF** converts the SVG with `svg2pdf.js` into `jsPDF`; both are imported with dynamic `import()` on first use, so the main bundle does not grow.
- **Scope.** The whole model or the selection; the viewBox fits the content plus padding.
