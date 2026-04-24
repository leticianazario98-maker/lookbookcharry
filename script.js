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
    try {
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

        // Scale menor para o ZIP não ficar pesado demais
        const viewport = page.getViewport({ scale: 1.5 });

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise;

        const imageUrl = canvas.toDataURL("image/jpeg", 0.85);

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

    } catch (error) {
      console.error(error);
      statusEl.textContent = "Erro ao processar o PDF.";
      alert("Erro ao processar o PDF. Veja se o arquivo está correto.");
    }
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
    <a href="${imageUrl}" download="${code}_pagina_${page}.jpg">Baixar imagem</a>
  `;

  resultsEl.appendChild(card);
}

downloadCsvBtn.addEventListener("click", () => {
  let csv = "codigo,pagina,nome_arquivo\n";

  extractedProducts.forEach((product, index) => {
    const fileName = `${product.codigo}_pagina_${product.pagina}_${index + 1}.jpg`;
    csv += `${product.codigo},${product.pagina},${fileName}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "produtos.csv";
  link.click();

  URL.revokeObjectURL(url);
});

downloadImagesBtn.addEventListener("click", async () => {
  if (extractedProducts.length === 0) {
    alert("Nenhuma imagem foi gerada ainda.");
    return;
  }

  downloadImagesBtn.disabled = true;
  downloadImagesBtn.textContent = "Gerando ZIP...";
  statusEl.textContent = "Gerando arquivo ZIP com as imagens...";

  try {
    const zip = new JSZip();

    extractedProducts.forEach((product, index) => {
      const base64Data = product.imagem.split(",")[1];
      const fileName = `${product.codigo}_pagina_${product.pagina}_${index + 1}.jpg`;

      zip.file(fileName, base64Data, { base64: true });
    });

    const zipBlob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: {
        level: 6
      }
    });

    const url = URL.createObjectURL(zipBlob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "imagens-produtos.zip";
    link.click();

    URL.revokeObjectURL(url);

    statusEl.textContent = `ZIP gerado com ${extractedProducts.length} imagens.`;
  } catch (error) {
    console.error(error);
    alert("Erro ao gerar o ZIP. Tente reduzir o PDF ou processar menos páginas.");
    statusEl.textContent = "Erro ao gerar o ZIP.";
  }

  downloadImagesBtn.disabled = false;
  downloadImagesBtn.textContent = "Baixar todas imagens";
});
