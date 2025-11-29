#!/usr/bin/env python3
"""
Generate synthetic Excel Q&A examples
"""
import json
import random
from pathlib import Path

def generate_sum_example():
    """Generate SUM formula example"""
    values = [random.randint(100, 1000) for _ in range(4)]
    total = sum(values)

    return {
        'type': 'formula',
        'formula': '=SUM(A1:A4)',
        'data': {'A1': values[0], 'A2': values[1], 'A3': values[2], 'A4': values[3]},
        'question': 'What is the total?',
        'answer': f'The total is ${total:,}, calculated by summing cells A1 through A4 ({values[0]} + {values[1]} + {values[2]} + {values[3]} = {total}).',
        'reasoning': [
            'Identify the SUM formula',
            'Sum all values in range A1:A4',
            f'Calculate: {" + ".join(map(str, values))} = {total}'
        ]
    }

def generate_average_example():
    """Generate AVERAGE calculation example"""
    values = [random.randint(50, 200) for _ in range(5)]
    avg = sum(values) / len(values)

    return {
        'type': 'aggregation',
        'operation': 'AVERAGE',
        'data': {'Sales': values},
        'question': 'What is the average sales?',
        'answer': f'The average sales is ${avg:,.2f}, calculated by dividing the total sales of ${sum(values):,} by {len(values)} periods.',
        'reasoning': [
            'Sum all sales values',
            'Divide by count of periods',
            f'Calculate: {sum(values)} / {len(values)} = {avg:.2f}'
        ]
    }

def generate_growth_example():
    """Generate growth rate calculation example"""
    start = random.randint(1000, 5000)
    end = int(start * random.uniform(1.1, 1.5))
    growth = ((end - start) / start) * 100

    return {
        'type': 'calculation',
        'operation': 'GROWTH_RATE',
        'data': {'2023': start, '2024': end},
        'question': 'What is the growth rate from 2023 to 2024?',
        'answer': f'The growth rate is {growth:.1f}%, calculated as the change from ${start:,} (2023) to ${end:,} (2024), representing an increase of ${end-start:,}.',
        'reasoning': [
            'Calculate change: 2024 - 2023',
            'Divide by starting value',
            'Multiply by 100 for percentage',
            f'Calculate: ({end} - {start}) / {start} * 100 = {growth:.1f}%'
        ]
    }

def generate_comparison_example():
    """Generate comparison example"""
    products = ['Widget', 'Gadget', 'Doohickey']
    sales = {p: random.randint(1000, 5000) for p in products}
    best = max(sales, key=sales.get)
    worst = min(sales, key=sales.get)

    return {
        'type': 'comparison',
        'operation': 'MAX/MIN',
        'data': sales,
        'question': 'Which product has the highest sales?',
        'answer': f'{best} has the highest sales at ${sales[best]:,}, followed by {sorted(sales.items(), key=lambda x: x[1], reverse=True)[1][0]} at ${sorted(sales.items(), key=lambda x: x[1], reverse=True)[1][1]:,}. {worst} has the lowest at ${sales[worst]:,}.',
        'reasoning': [
            'Compare all product sales',
            f'Identify maximum: {best} = ${sales[best]:,}',
            f'Identify minimum: {worst} = ${sales[worst]:,}',
            'Provide context with rankings'
        ]
    }

def generate_trend_example():
    """Generate trend analysis example"""
    years = [2020, 2021, 2022, 2023]
    base = random.randint(1000, 3000)
    growth_rate = random.uniform(1.1, 1.3)
    values = [int(base * (growth_rate ** i)) for i in range(len(years))]

    trend_type = "accelerating growth" if growth_rate > 1.2 else "steady growth"

    return {
        'type': 'trend_analysis',
        'operation': 'TREND',
        'data': dict(zip(years, values)),
        'question': 'What is the trend over time?',
        'answer': f'The data shows {trend_type} from {years[0]} to {years[-1]}. Revenue increased from ${values[0]:,} to ${values[-1]:,}, representing a {((values[-1]/values[0])-1)*100:.1f}% total increase over the period.',
        'reasoning': [
            'Calculate year-over-year changes',
            'Identify pattern (accelerating/steady/declining)',
            'Calculate total change',
            'Interpret business significance'
        ]
    }

def generate_examples(count=30):
    """Generate diverse Excel examples"""

    generators = [
        generate_sum_example,
        generate_average_example,
        generate_growth_example,
        generate_comparison_example,
        generate_trend_example
    ]

    examples = []

    for i in range(count):
        generator = generators[i % len(generators)]
        example = generator()
        example['id'] = f'synthetic_{i+1}'
        examples.append(example)

    return examples

def main():
    print("=" * 60)
    print("Synthetic Excel Example Generator")
    print("=" * 60)
    print()

    # Generate examples
    print("Generating 30 synthetic examples...")
    examples = generate_examples(30)

    # Save to file
    output_file = 'training-data/excel/synthetic_examples.json'
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(examples, f, indent=2, ensure_ascii=False)

    print(f"[OK] Saved {len(examples)} examples to {output_file}")

    # Print summary
    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)
    print(f"Total examples: {len(examples)}")
    print("\nExample types:")
    type_counts = {}
    for e in examples:
        t = e['type']
        type_counts[t] = type_counts.get(t, 0) + 1

    for t, count in type_counts.items():
        print(f"  - {t}: {count}")

    print("\nSample example:")
    print(f"  Q: {examples[0]['question']}")
    print(f"  A: {examples[0]['answer'][:100]}...")

if __name__ == '__main__':
    main()
