# Source
- https://github.com/openai/openai-apps-sdk-examples

# Setup 

- **Prerequisites**
    - Node.js 18+
    - pnpm (recommended) or npm/yarn
    - Python 3.10+

- **Install Dependencies**
    - `pnpm install`

- **Build Components Gallery**
    - `pnpm run build`

# [In-Review]

To iterate locally, you can also launch the Vite dev server:

```bash
pnpm run dev
```

## Serve the static assets

If you want to preview the generated bundles without the MCP servers, start the static file server after running a build:

```bash
pnpm run serve
```

The assets are exposed at [`http://localhost:4444`](http://localhost:4444) with CORS enabled so that local tooling (including MCP inspectors) can fetch them.

## Run the MCP servers

The repository ships several demo MCP servers that highlight different widget bundles:

- **Pizzaz (Node & Python)** – pizza-inspired collection of tools and components
- **Solar system (Python)** – 3D solar system viewer

Every tool response includes plain text content, structured JSON, and `_meta.openai/outputTemplate` metadata so the Apps SDK can hydrate the matching widget.

### Pizzaz Node server

```bash
cd pizzaz_server_node
pnpm start
```

### Pizzaz Python server

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r pizzaz_server_python/requirements.txt
uvicorn pizzaz_server_python.main:app --port 8000
```

### Solar system Python server

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r solar-system_server_python/requirements.txt
uvicorn solar-system_server_python.main:app --port 8000
```

You can reuse the same virtual environment for all Python servers—install the dependencies once and run whichever entry point you need.

## Testing in ChatGPT

To add these apps to ChatGPT, enable [developer mode](https://platform.openai.com/docs/guides/developer-mode), and add your apps in Settings > Connectors.

To add your local server without deploying it, you can use a tool like [ngrok](https://ngrok.com/) to expose your local server to the internet.

For example, once your mcp servers are running, you can run:

```bash
ngrok http 8000
```

You will get a public URL that you can use to add your local server to ChatGPT in Settings > Connectors.

For example: `https://<custom_endpoint>.ngrok-free.app/mcp`

## Next steps

- Customize the widget data: edit the handlers in `pizzaz_server_node/src`, `pizzaz_server_python/main.py`, or the solar system server to fetch data from your systems.
- Create your own components and add them to the gallery: drop new entries into `src/` and they will be picked up automatically by the build script.

## Contributing

You are welcome to open issues or submit PRs to improve this app, however, please note that we may not review all suggestions.

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.
