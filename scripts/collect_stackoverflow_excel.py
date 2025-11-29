#!/usr/bin/env python3
"""Collect Excel Q&A examples from StackOverflow"""
import requests, json, time
from pathlib import Path
from bs4 import BeautifulSoup

def fetch_excel_questions(limit=100):
    params = {'order': 'desc', 'sort': 'votes', 'tagged': 'excel', 'site': 'stackoverflow', 'filter': 'withbody', 'pagesize': min(limit, 100)}
    response = requests.get("https://api.stackexchange.com/2.3/questions", params=params)
    return response.json().get('items', []) if response.status_code == 200 else []

def fetch_answers(question_id):
    params = {'order': 'desc', 'sort': 'votes', 'site': 'stackoverflow', 'filter': 'withbody', 'pagesize': 1}
    response = requests.get(f"https://api.stackexchange.com/2.3/questions/{question_id}/answers", params=params)
    answers = response.json().get('items', []) if response.status_code == 200 else []
    return answers[0]['body'] if answers else None

def clean_html(text):
    return BeautifulSoup(text, 'html.parser').get_text()

def main():
    print("Fetching Excel Q&A from StackOverflow...")
    questions = fetch_excel_questions(50)
    examples = []
    for i, q in enumerate(questions[:50]):
        print(f"{i+1}/50: {q['title'][:50]}...")
        answer = fetch_answers(q['question_id'])
        if answer:
            examples.append({'id': q['question_id'], 'title': q['title'], 'question': clean_html(q.get('body', ''))[:500], 'answer': clean_html(answer)[:1000], 'votes': q['score'], 'tags': q['tags']})
            print(f"  [OK] Added")
        time.sleep(0.5)

    Path('training-data/excel').mkdir(parents=True, exist_ok=True)
    with open('training-data/excel/stackoverflow_examples.json', 'w', encoding='utf-8') as f:
        json.dump(examples, f, indent=2)
    print(f"\n[OK] Saved {len(examples)} examples")

if __name__ == '__main__':
    main()
