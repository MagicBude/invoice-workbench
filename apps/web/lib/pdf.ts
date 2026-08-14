export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  pdfjs.GlobalWorkerOptions.workerSrc = `${basePath}/pdf.worker.min.mjs`;

  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data });
  const document = await loadingTask.promise;

  let text = '';
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    text += `${content.items
      .map((item) => ('str' in item ? item.str : ''))
      .filter(Boolean)
      .join(' ')}\n`;
  }

  await document.destroy();
  return text.trim();
}
