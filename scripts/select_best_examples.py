#!/usr/bin/env python3
"""
Select best examples for system prompts
"""
import json
from pathlib import Path

def load_examples(file_path):
    """Load examples from JSON file"""
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def select_stackoverflow_examples(examples, limit=10):
    """Select top StackOverflow examples by votes"""
    sorted_examples = sorted(examples, key=lambda x: x.get('votes', 0), reverse=True)
    return sorted_examples[:limit]

def select_synthetic_examples(examples, limit=10):
    """Select diverse synthetic examples"""
    # Get one of each type
    by_type = {}
    for e in examples:
        t = e['type']
        if t not in by_type:
            by_type[t] = e

    return list(by_type.values())[:limit]

def format_for_prompt(example, source='stackoverflow'):
    """Format example for system prompt"""

    if source == 'stackoverflow':
        return {
            'question': example['title'],
            'context': example['question'][:200] + '...' if len(example['question']) > 200 else example['question'],
            'answer': example['answer'][:300] + '...' if len(example['answer']) > 300 else example['answer']
        }
    else:  # synthetic
        return {
            'question': example['question'],
            'data': example.get('data', {}),
            'answer': example['answer'],
            'reasoning': example.get('reasoning', [])
        }

def main():
    print("=" * 60)
    print("Best Example Selector")
    print("=" * 60)
    print()

    # Load examples
    print("Loading examples...")
    stackoverflow = load_examples('training-data/excel/stackoverflow_examples.json')
    synthetic = load_examples('training-data/excel/synthetic_examples.json')

    # Select best
    print("Selecting best examples...")
    best_stackoverflow = select_stackoverflow_examples(stackoverflow, 10)
    best_synthetic = select_synthetic_examples(synthetic, 10)

    # Format for prompts
    formatted = {
        'stackoverflow': [format_for_prompt(e, 'stackoverflow') for e in best_stackoverflow],
        'synthetic': [format_for_prompt(e, 'synthetic') for e in best_synthetic]
    }

    # Save
    output_file = 'training-data/excel/best_examples.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(formatted, f, indent=2, ensure_ascii=False)

    print(f"[OK] Saved {len(formatted['stackoverflow']) + len(formatted['synthetic'])} best examples to {output_file}")

    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)
    print(f"StackOverflow examples: {len(formatted['stackoverflow'])}")
    print(f"Synthetic examples: {len(formatted['synthetic'])}")
    print(f"Total: {len(formatted['stackoverflow']) + len(formatted['synthetic'])}")

if __name__ == '__main__':
    main()
