# Documentation Style Guide

To keep the manual consistent, follow these conventions when adding or updating content.

## Tone & Voice
- Favor clear, direct language
- Prefer “you” when giving instructions
- Link to source files (GitHub paths) when referencing implementation details

## Structure
- Start each page with a short overview paragraph
- Use sentence case headings (`## Working with Lists`)
- Include runnable examples where possible; label code blocks with the language (` ```funcscript `)

## Examples
- Show inputs and outputs
- Highlight edge cases (nulls, empty lists, unexpected types)
- Keep examples concise; move lengthy walkthroughs to dedicated sections

## Cross References
- Link to related sections using relative paths (`[types](../language/types.md)`)
- Avoid duplicating content—explain concepts once, then cross-reference

## Assets
- Place diagrams and images in `docs/assets/`
- Use SVG where possible to keep files sharp and small

## Contributor Checklist
- Run `mkdocs serve` locally and proofread the rendered page
- Update the navigation in `mkdocs.yml` if you create new pages
- Mention major additions in pull request summaries
