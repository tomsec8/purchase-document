# Purchase Document

A local page that turns an English AliExpress order image into a receipt or an invoice-style summary.

The image is read in the browser with Tesseract. It is not uploaded. The OCR engine, the WASM runtime, and the English language data are copied into `public/` when you install dependencies. The page does not load them from a CDN.

```bash
npm install
npm run dev
```

Open the printed local address. Choose an order image, check the fields, then download a PDF or PNG.

`npm test` checks the AliExpress parser. `npm run probe -- path/to/image.jpg` prints what Tesseract extracted on this machine.
