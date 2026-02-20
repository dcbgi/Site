# Site

A personal profile website that showcases projects I create.

## Structure

| File | Purpose |
|------|---------|
| `index.html` | Main page — profile hero, projects grid, contact section |
| `styles.css` | Dark-theme responsive styles |
| `script.js` | Project data + dynamic card rendering |

## Adding a New Project

Open `script.js` and add an entry to the `projects` array:

```js
{
  title: "My Project",
  icon: "🚀",
  desc: "Short description of what this project does.",
  tags: ["Python", "FastAPI"],
  github: "https://github.com/dcbgi/my-project",   // optional
  demo:   "https://my-project.example.com",          // optional
}
```

Save the file — the card appears automatically on the page.

## Running Locally

Open `index.html` directly in a browser, or serve it with any static file server:

```bash
npx serve .
```
