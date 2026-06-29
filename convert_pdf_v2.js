
const pdf2img = require('pdf-img-convert');
const fs = require('fs');

(async function () {
    const outputDir = '/Users/jluque/.gemini/antigravity/scratch/refiai/public/content/unit-0-1/slides';
    const pdfPath = '/Users/jluque/Library/CloudStorage/GoogleDrive-jluque@escp.eu/My Drive/ReFiAI/REFI ESCP /Unit 0.1. - Real Estate Economics/Slides/Slides - Real Estate System and the CAP rate.pdf';

    console.log("Reading PDF...");
    const pdfArray = await pdf2img.convert(pdfPath);

    console.log(`Converted ${pdfArray.length} pages. Saving...`);
    for (let i = 0; i < pdfArray.length; i++) {
        fs.writeFileSync(`${outputDir}/slide_${i + 1}.png`, pdfArray[i]);
    }
    console.log("Done.");
})();
