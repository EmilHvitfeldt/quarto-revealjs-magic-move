# Magic Move Extension for Quarto revealjs

A Quarto extension that enables smooth animated transitions between code states in revealjs presentations.

## Installation

```bash
quarto add emilhvitfeldt/quarto-revealjs-magic-move
```

## Usage

Add the extension to your document's YAML header:

```yaml
---
format: revealjs
revealjs-plugins:
  - magic-move
---
```

Then wrap consecutive code blocks in a `magic-move` div:

````markdown
::: magic-move

```javascript
if (condition) a else b
```

```javascript
if (condition) {
  a
} else {
  b
}
```

:::
````

Each code block represents a step. Press space/arrow keys to animate between steps.

## Limitations

- Token matching is content-based; significantly different code may fade instead of animate

## License

MIT
