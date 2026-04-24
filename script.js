pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const pdfInput = document.getElementById("pdfInput");
const processBtn = document.getElementById("processBtn");
const downloadCsvBtn = document.getElementById("downloadCsvBtn");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");

let extractedProducts = [];

processBtn.addEventListener("click", async () => {
  const file = pdfInput.files[0];

  if (!file) {
    alert("Selecione o PDF primeiro.");
    return;
  }

  extractedProducts = [];
  resultsEl.innerHTML = "";
  downloadCsvBtn.disabled = true;

  statusEl.textContent = "Lendo PDF...";

  const fileReader = new FileReader();

  fileReader.onload = async function () {
    const typedarray = new Uint8Array(this.result);
    const pdf = await pdfjsLib.getDocument(typedarray).promise;

    statusEl.textContent = `PDF carregado. Processando ${pdf.numPages} páginas...`;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      statusEl.textContent = `Processando página ${pageNum} de ${pdf.numPages}...`;

      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      const pageText = textContent.items.map(item => item.str).join(" ");

      const codes = extractProductCodes(pageText);

      if (codes.length === 0) continue;

      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;

      codes.forEach((code, index) => {
        const imageUrl = createProductImage(canvas, index, codes.length);

        extractedProducts.push({
          codigo: code,
          pagina: pageNum,
          imagem: imageUrl
        });

        renderCard(code, pageNum, imageUrl);
      });
    }

    statusEl.textContent = `Finalizado! ${extractedProducts.length} produtos encontrados.`;
    downloadCsvBtn.disabled = extractedProducts.length === 0;
  };

  fileReader.readAsArrayBuffer(file);
});

function extractProductCodes(text) {
  const regex = /\b\d{6}\b/g;
  const matches = text.match(regex) || [];

  return [...new Set(matches)];
}

function createProductImage(canvas, index, totalCodes) {
  const cropCanvas = document.createElement("canvas");
  const cropContext = cropCanvas.getContext("2d");

  const width = canvas.width;
  const height = canvas.height;

  let sx = 0;
  let sy = 0;
  let sw = width;
  let sh = height;

  if (totalCodes === 1) {
    sx = 0;
    sy = 0;
    sw = width;
    sh = height;
  }

  if (totalCodes === 2) {
    sw = width / 2;
    sx = index === 0 ? 0 : width / 2;
  }

  if (totalCodes >= 3) {
    sw = width / 2;
    sh = height / 2;

    sx = index % 2 === 0 ? 0 : width / 2;
    sy = index < 2 ? 0 : height / 2;
  }

  cropCanvas.width = sw;
  cropCanvas.height = sh;

  cropContext.drawImage(
    canvas,
    sx,
    sy,
    sw,
    sh,
    0,
    0,
    sw,
    sh
  );

  return cropCanvas.toDataURL("image/jpeg", 0.9);
}

function renderCard(code, page, imageUrl) {
  const card = document.createElement("div");
  card.className = "card";

  card.innerHTML = `
    <img src="${imageUrl}" alt="Produto ${code}">
    <strong>Código: ${code}</strong>
    <span>Página: ${page}</span>
    <a href="${imageUrl}" download="${code}.jpg">Baixar imagem</a>
  `;

  resultsEl.appendChild(card);
}

downloadCsvBtn.addEventListener("click", () => {
  let csv = "codigo,pagina,imagem_base64\n";

  extractedProducts.forEach(product => {
    csv += `${product.codigo},${product.pagina},"${product.imagem}"\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "produtos-com-imagens.csv";
  link.click();
});
