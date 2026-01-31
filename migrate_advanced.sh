#!/bin/bash

SOURCE_BASE="/Users/jluque/Library/CloudStorage/GoogleDrive-jluque@escp.eu/My Drive/ReFiAI/REFI ESCP "
DEST_BASE="src/public/content/advanced"

# Function to safely copy
safe_copy() {
    mkdir -p "$(dirname "$2")"
    cp "$1" "$2"
}

echo "Migrating Unit 7 (MBS)..."
safe_copy "$SOURCE_BASE/Unit 7. - MBS/Slides/Lecture Notes Chapter 20.pptx" "$DEST_BASE/mbs/slides.pptx"

echo "Migrating Unit 8 (REITs)..."
safe_copy "$SOURCE_BASE/Unit 8. - REITs/1. Guide To REITs.pdf" "$DEST_BASE/reits/reading.pdf"
safe_copy "$SOURCE_BASE/Unit 8. - REITs/rehypo sept 2010.ppt" "$DEST_BASE/reits/slides.ppt"

echo "Migrating Unit 9 (Development)..."
safe_copy "$SOURCE_BASE/Unit 9. - Real Estate Development Finance/Slides/Real Estate Development Finance.pptx" "$DEST_BASE/development/slides.pptx"

echo "Migrating Unit 10 (Tax Analysis)..."
safe_copy "$SOURCE_BASE/Unit 10. - After-Tax Analysis/After-Tax Analysis.pptx" "$DEST_BASE/tax/slides.pptx"
safe_copy "$SOURCE_BASE/Unit 10. - After-Tax Analysis/RE410 After Tax Analysis Lecture Discussion Questions.pdf" "$DEST_BASE/tax/questions.pdf"

echo "Advanced Topics Migration Complete."
