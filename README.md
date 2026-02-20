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

## Testing

Tests live in `tests/projects.test.js` and use [Jest](https://jestjs.io/).  
They validate every project entry in the `projects` array and the rendering logic, so a malformed project is caught before it reaches production.

```bash
npm install      # first time only
npm test
```

The tests check that each project:
- Has required non-empty string fields: `title`, `icon`, `desc`
- Has `tags` as an array of non-empty strings
- Uses valid HTTPS URLs for the optional `github` and `demo` fields

They also verify that HTML special characters in project data are escaped (XSS protection) and that the card renderer produces the expected output.

## Running Locally

Open `index.html` directly in a browser, or serve it with any static file server:

```bash
npx serve .
```

## Deploying via cPanel

This repository includes a `.cpanel.yml` file that enables automatic deployment through cPanel's **Git Version Control** feature.

**Setup (one-time):**
1. Log in to cPanel and open **Git Version Control**.
2. Clone this repository using its GitHub URL.

**Deploying updates:**
- Push commits to the linked branch, then click **Update** followed by **Deploy HEAD Commit** in cPanel, or
- Use the **Deploy HEAD Commit** button at any time to manually trigger a deployment.

Files deployed to `public_html`: `index.html`, `styles.css`, `script.js`.
