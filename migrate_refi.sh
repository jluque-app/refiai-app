#!/bin/bash

SOURCE_BASE="/Users/jluque/Library/CloudStorage/GoogleDrive-jluque@escp.eu/My Drive/ReFiAI/REFI ESCP "
DEST_BASE="src/public/content/refi"

# Function to safely copy
safe_copy() {
    mkdir -p "$(dirname "$2")"
    cp "$1" "$2"
}

echo "Migrating Unit 1..."
safe_copy "$SOURCE_BASE/Unit 1. - Basic Real Estate Investment Model/Teaching notes, slides and videos/Basic Real Estate Investment Model.pptx" "$DEST_BASE/unit-1/slides.pptx"
safe_copy "$SOURCE_BASE/Unit 1. - Basic Real Estate Investment Model/Teaching notes, slides and videos/CREFI - D. Property_Level_Valuation_Investment_Returns.mp4" "$DEST_BASE/unit-1/video.mp4"
safe_copy "$SOURCE_BASE/Unit 1. - Basic Real Estate Investment Model/Teaching notes, slides and videos/Proforma.pptx" "$DEST_BASE/unit-1/proforma.pptx"

echo "Migrating Unit 2..."
safe_copy "$SOURCE_BASE/Unit 2. - Real Estate Capital Structures/Slides/Real Estate Capital Structures.pptx" "$DEST_BASE/unit-2/slides.pptx"
safe_copy "$SOURCE_BASE/Unit 2. - Real Estate Capital Structures/Slides/CREFI - Real_Estate_Capital_Structures.mp4" "$DEST_BASE/unit-2/video.mp4"

echo "Migrating Unit 3..."
safe_copy "$SOURCE_BASE/Unit 3. - Commerical Mortgages/Teaching notes, slides and exercises for class/1. Commercial Mortgages.pptx" "$DEST_BASE/unit-3/slides.pptx"
safe_copy "$SOURCE_BASE/Unit 3. - Commerical Mortgages/Teaching notes, slides and exercises for class/4. Commercial Mortgages-Default & Mortgage Underwriting.pptx" "$DEST_BASE/unit-3/underwriting.pptx"

echo "Migrating Unit 4..."
safe_copy "$SOURCE_BASE/Unit 4. - Distressed debt - Foreclosure Vs. Restructuring/Readings/Financial Distress.pptx" "$DEST_BASE/unit-4/slides.pptx"
safe_copy "$SOURCE_BASE/Unit 4. - Distressed debt - Foreclosure Vs. Restructuring/Readings/The subprime mortgage crisis and its aftermath.pdf" "$DEST_BASE/unit-4/reading.pdf"

echo "Migrating Unit 5..."
# Placeholder for Unit 5 based on what I find, assuming standard naming if not found yet
safe_copy "$SOURCE_BASE/Unit 5. - Simple Financial Feasibility Analysis/CREFI SFFA & Afford Housing/Slides/Front Door Back Door Model.pptx" "$DEST_BASE/unit-5/slides.pptx"

echo "Migrating Unit 6..."
safe_copy "$SOURCE_BASE/Unit 6. - Debt, leverage and risk/Slides and class exercise/Debt, Leverage and Risk.pptx" "$DEST_BASE/unit-6/slides.pptx"
safe_copy "$SOURCE_BASE/Unit 6. - Debt, leverage and risk/Slides and class exercise/Debt, Leverage and Risk-Class Exercise.xlsx" "$DEST_BASE/unit-6/exercise.xlsx"

echo "REFI Migration Complete."
