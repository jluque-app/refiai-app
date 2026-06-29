
import fitz  # PyMuPDF
import os

pdf_path = '/Users/jluque/Library/CloudStorage/GoogleDrive-jluque@escp.eu/My Drive/ReFiAI/REFI ESCP /Unit 0.1. - Real Estate Economics/Slides/Slides - Real Estate System and the CAP rate.pdf'
output_dir = '/Users/jluque/.gemini/antigravity/scratch/refiai/public/content/unit-0-1/slides'

if not os.path.exists(output_dir):
    os.makedirs(output_dir)

print(f"Opening PDF: {pdf_path}")
doc = fitz.open(pdf_path)
print(f"Number of pages: {len(doc)}")

for i, page in enumerate(doc):
    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2)) # 2x zoom for better quality
    output_file = os.path.join(output_dir, f"slide_{i + 1}.png")
    pix.save(output_file)
    print(f"Saved {output_file}")

print("Conversion complete.")
