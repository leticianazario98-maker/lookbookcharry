pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const pdfInput = document.getElementById("pdfInput");
const processBtn = document.getElementById("processBtn");
const downloadCsvBtn = document.getElementById("downloadCsvBtn");
const downloadImagesBtn = document.getElementById("downloadImagesBtn");
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
  downloadImagesBtn.disabled = true;

  statusEl.textContent = "Lendo PDF...";

  const fileReader = new FileReader();

  fileReader.onload = async function () {
    const typedarray = new Uint8Array(this.result);
    const pdf = await pdfjsLib.getDocument(typedarray).promise;

    statusEl.textContent = `Processando ${pdf.numPages} páginas...`;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      statusEl.textContent = `Página ${pageNum}/${pdf.numPages}`;

      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      const pageText = textContent.items.map(item => item.str).join(" ");
      const codes = extractProductCodes(pageText);

      if (codes.length === 0) continue;

      const viewport = page.getViewport({ scale: 3 });

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;

      const imageUrl = canvas.toDataURL("image/jpeg", 0.95);

      codes.forEach((code) => {
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
    downloadImagesBtn.disabled = extractedProducts.length === 0;
  };

  fileReader.readAsArrayBuffer(file);
});

function extractProductCodes(text) {
  const regex = /\b\d{6}\b/g;
  const matches = text.match(regex) || [];
  return [...new Set(matches)];
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
  let csv = "codigo,pagina,nome_arquivo\n";

  extractedProducts.forEach(product => {
    csv += `${product.codigo},${product.pagina},${product.codigo}_pagina_${product.pagina}.jpg\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "produtos.csv";
  link.click();
});

downloadImagesBtn.addEventListener("click", async () => {
  if (extractedProducts.length === 0) {
    alert("Nenhuma imagem foi gerada ainda.");
    return;
  }

  const zip = new JSZip();

  extractedProducts.forEach((product, index) => {
    const base64Data = product.imagem.split(",")[1];
    const fileName = `${product.codigo}_pagina_${product.pagina}_${index + 1}.jpg`;

    zip.file(fileName, base64Data, { base64: true });
  });

  const zipBlob = await zip.generateAsync({ type: "blob" });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(zipBlob);
  link.download = "imagens-produtos.zip";
  link.click();
});
