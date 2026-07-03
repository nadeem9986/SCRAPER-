# Resume Company Job Finder

Apify actor for finding jobs at a target company that match Yasar Ameen H N's resume focus:

- Agentic AI, Generative AI, RAG, LLMs
- Python, LangChain, LangGraph, FastAPI
- React/full-stack engineering
- SQL, data science, cloud, Azure AI
- Entry-level software and AI roles

## Input Modes

Single company:

```json
{
  "company": "IBM",
  "careerUrl": "https://www.ibm.com/in-en/careers/search"
}
```

Multiple companies:

```json
{
  "companies": [
    { "name": "IBM", "careerUrl": "https://www.ibm.com/in-en/careers/search" },
    { "name": "Microsoft", "careerUrl": "https://jobs.careers.microsoft.com/global/en/search" }
  ]
}
```

`careerUrl` is optional, but providing it is more reliable for companies with complex career sites.

## Run Locally

```bash
npm install
npm start
```

Results are written to:

- Apify default dataset
- key-value store key `MATCH_SUMMARY`
- `frontend/data/jobs.json`
- `frontend/data/summary.json`

## View Frontend

```bash
npm run frontend
```

Then open:

```text
http://localhost:5173
```

## Run On Apify

```bash
apify login
apify push
apify call
```

## Notes

- If `careerUrl` is provided, it searches that page directly.
- If only `company` is provided, it tries to auto-discover a likely careers/jobs page.
- It supports Workday, Greenhouse, Lever, Ashby, SmartRecruiters-style pages through generic browser extraction.
- It searches each configured keyword, extracts job links/cards, and ranks them with resume-aware scoring.

It does not upload your resume or submit applications.
