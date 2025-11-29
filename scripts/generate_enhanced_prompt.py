#!/usr/bin/env python3
"""
Generate enhanced system prompt with training examples
"""
import json

def load_best_examples():
    """Load best examples"""
    with open('training-data/excel/best_examples.json', 'r', encoding='utf-8') as f:
        return json.load(f)

def generate_excel_prompt(examples):
    """Generate Excel-specific system prompt"""

    prompt = """
## EXCEL ANALYSIS EXPERTISE
You are an expert at analyzing Excel spreadsheets. Follow these rules:

### Formula Understanding
When you encounter Excel formulas:
1. Explain what the formula calculates
2. Show the step-by-step logic
3. Provide the result with context

### Data Analysis
When analyzing spreadsheet data:
1. Calculate totals, averages, and other aggregations
2. Identify trends and patterns
3. Compare values and highlight differences
4. Provide quantitative context (percentages, growth rates)

### Multi-Sheet Analysis
When data spans multiple sheets:
1. Identify relationships between sheets
2. Connect related data points
3. Perform cross-sheet calculations

### Examples:
"""

    # Add synthetic examples
    for i, ex in enumerate(examples['synthetic'][:5], 1):
        prompt += f"\n**Example {i}: {ex['question']}**\n"
        if 'data' in ex:
            prompt += f"Data: {json.dumps(ex['data'], indent=2)}\n"
        prompt += f"Answer: {ex['answer']}\n"
        if 'reasoning' in ex:
            prompt += "Reasoning:\n"
            for step in ex['reasoning']:
                prompt += f"  - {step}\n"

    return prompt

def generate_pdf_prompt():
    """Generate PDF-specific system prompt"""

    return """
## PDF ANALYSIS EXPERTISE
When analyzing PDF documents:

### Table Extraction
1. Identify table structure (rows, columns, headers)
2. Extract data accurately
3. Understand table context from surrounding text
4. Perform calculations on table data

### Multi-Page Context
1. Connect information across pages
2. Follow cross-references
3. Maintain document context

### Chart Interpretation
1. Describe what charts show
2. Identify trends and patterns
3. Connect charts to text explanations
"""

def generate_general_prompt():
    """Generate general analysis prompt"""

    return """
## GENERAL ANALYSIS PRINCIPLES

### Response Enhancement
Always enhance your responses with:
1. **Quantitative context**: "X represents 45% of total"
2. **Categorical grouping**: "primarily reports (32) and contracts (18)"
3. **Temporal context**: "from 2020-2024"
4. **Significance**: "notably...", "this indicates..."
5. **Comparisons**: "6x higher than...", "unlike..."

### Answer Structure
1. Start with direct answer
2. Add Layer 1 context (quantitative, categorical, temporal)
3. Add Layer 2 insights (significance, causality, comparisons) for complex queries

### Format Selection
- **Tables**: For comparing 2+ entities with multiple attributes
- **Bullets**: For lists of 4+ items
- **Paragraphs**: For explanations and analysis
- **Short answer**: For simple facts (1-2 sentences)
"""

def main():
    print("=" * 60)
    print("Enhanced System Prompt Generator")
    print("=" * 60)
    print()

    # Load examples
    print("Loading best examples...")
    examples = load_best_examples()

    # Generate prompts
    print("Generating enhanced prompts...")
    excel_prompt = generate_excel_prompt(examples)
    pdf_prompt = generate_pdf_prompt()
    general_prompt = generate_general_prompt()

    # Combine
    full_prompt = general_prompt + "\n" + excel_prompt + "\n" + pdf_prompt

    # Save
    output_file = 'training-data/enhanced_system_prompt.txt'
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(full_prompt)

    print(f"[OK] Generated enhanced system prompt ({len(full_prompt)} characters)")
    print(f"[OK] Saved to {output_file}")

    print("\n" + "=" * 60)
    print("Preview (first 500 characters)")
    print("=" * 60)
    print(full_prompt[:500] + "...")

if __name__ == '__main__':
    main()
