
import { exportImages } from 'pdf-export-images';

async function convert() {
    const success = await exportImages('/Users/jluque/Library/CloudStorage/GoogleDrive-jluque@escp.eu/My Drive/ReFiAI/REFI ESCP /Unit 0.1. - Real Estate Economics/Slides/Slides - Real Estate System and the CAP rate.pdf', '/Users/jluque/.gemini/antigravity/scratch/refiai/public/content/unit-0-1/images');
    console.log('Conversion result:', success);
}

convert();
