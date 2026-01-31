#!/bin/bash

# Define source base
SOURCE_BASE="/Users/jluque/Library/CloudStorage/GoogleDrive-jluque@escp.eu/My Drive/ReFiAI/REFI ESCP "
DEST_BASE="src/public/content/real-estate-101"

echo "Migrating Excel 101 Content..."
cp "$SOURCE_BASE/Unit 0.2. - Present Value Math/Slides/Slides - Present Value Math for Real Estate and Investment Decisions.pptx" "$DEST_BASE/excel/slides.pptx"
cp "$SOURCE_BASE/Unit 0.2. - Present Value Math/Readings and Videos/GM Ch 8.pdf" "$DEST_BASE/excel/reading.pdf"

echo "Migrating Economics 101 Content..."
cp "$SOURCE_BASE/Unit 0.1. - Real Estate Economics/Slides/Slides - Real Estate System and the CAP rate.pptx" "$DEST_BASE/economics/slides.pptx"
cp "$SOURCE_BASE/Unit 0.1. - Real Estate Economics/Readings and Videos/CapRate_H22014_Master[1].pdf" "$DEST_BASE/economics/reading.pdf"

echo "Migrating Finance 101 Content..."
cp "$SOURCE_BASE/Unit 0.3. - Foundations of asset prcing/Slides and classnotes/Slides Foundations of Real Estate Asset Pricing.pptx" "$DEST_BASE/finance/slides.pptx"
cp "$SOURCE_BASE/Unit 0.3. - Foundations of asset prcing/Slides and classnotes/Quintin's class notes - Ch 3.pdf" "$DEST_BASE/finance/reading.pdf"

echo "Migration Complete."
