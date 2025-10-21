import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { URL, fileURLToPath } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  type CallToolRequest,
  type ListResourceTemplatesRequest,
  type ListResourcesRequest,
  type ListToolsRequest,
  type ReadResourceRequest,
  type Resource,
  type ResourceTemplate,
  type Tool
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import axios from "axios"; 

// app version
const APP_VERSION = "1.3";

// types
type PizzazWidget = {
  id: string;
  title: string;
  templateUri: string;
  invoking: string;
  invoked: string;
  html: string;
  responseText: string;
};
type PhotoMetadata = {
  id: string;
  author: string;
  download_url: string; 
};

// paths
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..");
const ASSETS_DIR = path.resolve(ROOT_DIR, "assets");

// read widget HTML
function readWidgetHtml(componentName: string): string {
  const directPath = path.join(ASSETS_DIR, `${componentName}.html`);
  let htmlContents: string | null = null;

  if (fs.existsSync(directPath)) {
    htmlContents = fs.readFileSync(directPath, "utf8");
  } else {
    const candidates = fs
      .readdirSync(ASSETS_DIR)
      .filter(
        (file) => file.startsWith(`${componentName}-`) && file.endsWith(".html")
      )
      .sort();
    const fallback = candidates[candidates.length - 1];
    if (fallback)
      htmlContents = fs.readFileSync(path.join(ASSETS_DIR, fallback), "utf8");
  }

  if (!htmlContents)
    throw new Error(`Widget HTML for "${componentName}" not found in ${ASSETS_DIR}. Run "pnpm run build" to generate the assets.`);
  return htmlContents;
}

// widget metadata
function widgetMeta(widget: PizzazWidget) {
  return {
    "openai/outputTemplate": widget.templateUri,
    "openai/toolInvocation/invoking": widget.invoking,
    "openai/toolInvocation/invoked": widget.invoked,
    "openai/widgetAccessible": true,
    "openai/resultCanProduceWidget": true,
  } as const;
}

// widget
const widgets: PizzazWidget[] = [
  {
    id: "pizza-map",
    title: "Show Pizza Map",
    templateUri: "ui://widget/pizza-map.html",
    invoking: "Hand-tossing a map",
    invoked: "Served a fresh map",
    html: readWidgetHtml("pizzaz"),
    responseText: "Rendered a pizza map!",
  },
  {
    id: "pizza-carousel",
    title: "Show Pizza Carousel",
    templateUri: "ui://widget/pizza-carousel.html",
    invoking: "Carousel some spots",
    invoked: "Served a fresh carousel",
    html: readWidgetHtml("pizzaz-carousel"),
    responseText: "Rendered a pizza carousel!",
  },
  {
    id: "pizza-albums",
    title: "Show Pizza Album",
    templateUri: "ui://widget/pizza-albums.html",
    invoking: "Hand-tossing an album",
    invoked: "Served a fresh album",
    html: readWidgetHtml("pizzaz-albums"),
    responseText: "Rendered a pizza album!",
  },
  {
    id: "pizza-list",
    title: "Show Pizza List",
    templateUri: "ui://widget/pizza-list.html",
    invoking: "Hand-tossing a list",
    invoked: "Served a fresh list",
    html: readWidgetHtml("pizzaz-list"),
    responseText: "Rendered a pizza list!",
  },
];

// widgets by id & uri
const widgetsById = new Map<string, PizzazWidget>();
const widgetsByUri = new Map<string, PizzazWidget>();
widgets.forEach((widget) => {
  widgetsById.set(widget.id, widget);
  widgetsByUri.set(widget.templateUri, widget);
});

// resources
const resources: Resource[] = widgets.map((widget) => ({
  uri: widget.templateUri,
  name: widget.title,
  description: `${widget.title} widget markup`,
  mimeType: "text/html+skybridge",
  _meta: widgetMeta(widget)
}));

// resource templates
const resourceTemplates: ResourceTemplate[] = widgets.map((widget) => ({
  uriTemplate: widget.templateUri,
  name: widget.title,
  description: `${widget.title} widget markup`,
  mimeType: "text/html+skybridge",
  _meta: widgetMeta(widget)
}));

// tool input schema
const toolInputSchema = {
  type: "object",
  properties: {
    pizzaTopping: {
      type: "string",
      description: "Topping to mention when rendering the widget."
    }
  },
  required: ["pizzaTopping"],
  additionalProperties: false
} as const;

// input parser
const toolInputParser = z.object({
  pizzaTopping: z.string()
});

// MCP tools
const tools: Tool[] = widgets.map((widget) => ({
  name: widget.id,
  description: widget.title,
  inputSchema: toolInputSchema,
  title: widget.title,
  _meta: widgetMeta(widget),
  // to disable the approval prompt for the widgets
  annotations: {
    destructiveHint: false,
    openWorldHint: false,
    readOnlyHint: true,
  },
}));

// mcp tool handlers
const toolHandlers: Record<string, (args: any) => Promise<any>> = {
  "pizza-map": async (args) => {
    const response = await fetchRandomUser();
    const randomUser =  response.name;
    return {
      appVersion: APP_VERSION,
      pizzaTopping: args.pizzaTopping,
      user: randomUser,
    };
  },
  "pizza-carousel": async (args) => {
    const photoDetails = await fetchRandomPhoto();
    return {
      appVersion: APP_VERSION,
      pizzaTopping: args.pizzaTopping,
      image: {
        url: photoDetails,
        _displayOnly: true
      },
    };
  },
  "pizza-albums": async (args) => {
    const response = await fetchRandomUser();
    const randomUser =  response.name;
    return {
      appVersion: APP_VERSION,
      pizzaTopping: args.pizzaTopping,
      user: randomUser,
    };
  },
  "pizza-list": async (args) => {
    const response = await fetchRandomUser();
    const randomUser =  response.name;
    return {
      appVersion: APP_VERSION,
      pizzaTopping: args.pizzaTopping,
      user: randomUser,
    };
  },
};

// create MCP server
function createPizzazServer(): Server {
  // init server
  const server = new Server(
    {
      name: "pizzaz-node",
      version: "0.1.0"
    },
    {
      capabilities: {
        resources: {},
        tools: {}
      }
    }
  );

  // list resources
  server.setRequestHandler(ListResourcesRequestSchema, async (_request: ListResourcesRequest) => {
    return { resources };
  });

  // read resource
  server.setRequestHandler(ReadResourceRequestSchema, async (request: ReadResourceRequest) => {
    const widget = widgetsByUri.get(request.params.uri);
    if (!widget) {
      throw new Error(`Unknown resource: ${request.params.uri}`);
    }
    return {
      contents: [
        {
          uri: widget.templateUri,
          mimeType: "text/html+skybridge",
          text: widget.html,
          _meta: widgetMeta(widget)
        }
      ]
    };
  });

  // list resource templates
  server.setRequestHandler(ListResourceTemplatesRequestSchema, async (_request: ListResourceTemplatesRequest) => ({
    resourceTemplates
  }));

  // list tools
  server.setRequestHandler(ListToolsRequestSchema, async (_request: ListToolsRequest) => ({
    tools
  }));

  // call tool
  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
    const widget = widgetsById.get(request.params.name);
    if (!widget) {
      throw new Error(`Unknown tool: ${request.params.name}`);
    }

    // tool input args
    const args = toolInputParser.parse(request.params.arguments ?? {});

    // tool output handler
    const handler = toolHandlers[widget.id];
    const structuredContent = await handler(args);

    return {
      content: [
        {
          type: "text",
          text: widget.responseText
        }
      ],
      structuredContent,
      _meta: widgetMeta(widget)
    };
  });

  return server;
}

// session
type SessionRecord = {
  server: Server;
  transport: SSEServerTransport;
};
const sessions = new Map<string, SessionRecord>();

// SSE & POST endpoint
const ssePath = "/mcp";
const postPath = "/mcp/messages";

// handle SSE request
async function handleSseRequest(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const server = createPizzazServer();
  const transport = new SSEServerTransport(postPath, res);
  const sessionId = transport.sessionId;

  sessions.set(sessionId, { server, transport });

  transport.onclose = async () => {
    sessions.delete(sessionId);
    await server.close();
  };

  transport.onerror = (error) => {
    console.error("SSE transport error", error);
  };

  try {
    await server.connect(transport);
  } catch (error) {
    sessions.delete(sessionId);
    console.error("Failed to start SSE session", error);
    if (!res.headersSent) {
      res.writeHead(500).end("Failed to establish SSE connection");
    }
  }
}

// handle POST message
async function handlePostMessage(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL
) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  const sessionId = url.searchParams.get("sessionId");

  if (!sessionId) {
    res.writeHead(400).end("Missing sessionId query parameter");
    return;
  }

  const session = sessions.get(sessionId);

  if (!session) {
    res.writeHead(404).end("Unknown session");
    return;
  }

  try {
    await session.transport.handlePostMessage(req, res);
  } catch (error) {
    console.error("Failed to process message", error);
    if (!res.headersSent) {
      res.writeHead(500).end("Failed to process message");
    }
  }
}

// mcp host & port
const port = 8080;
const host = '0.0.0.0';

// create HTTP server
const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  if (!req.url) {
    res.writeHead(400).end("Missing URL");
    return;
  }

  // parse URL
  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

  // CORS preflight
  if (req.method === "OPTIONS" && (url.pathname === ssePath || url.pathname === postPath)) {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type"
    });
    res.end();
    return;
  }

  // handle SSE connection
  if (req.method === "GET" && url.pathname === ssePath) {
    await handleSseRequest(res);
    return;
  }

  // handle POST message
  if (req.method === "POST" && url.pathname === postPath) {
    await handlePostMessage(req, res, url);
    return;
  }

  // not found
  res.writeHead(404).end("Not Found");
});
httpServer.on("clientError", (err: Error, socket) => {
  console.error("HTTP client error", err);
  socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});
httpServer.listen(port, host, () => {
  console.log(`MCP server listening on http://${host}:${port}`);
  console.log(`  SSE stream: GET http://${host}:${port}${ssePath}`);
  console.log(`  Message post endpoint: POST http://${host}:${port}${postPath}?sessionId=...`);
});

// fetch random user
async function fetchRandomUser() {
  try {
    const response = await axios.get('https://randomuser.me/api/');
    return response.data.results[0];
  } catch (error) {
    console.error('Error fetching random user:', error);
    return null;
  }
}

// fetch random photo
async function fetchRandomPhoto() {
  try {
    const randomPage = Math.floor(Math.random() * 5) + 1; 
    const response = await axios.get(`https://picsum.photos/v2/list?page=${randomPage}&limit=10`);
    const photos: string[] = response.data.map((photo: PhotoMetadata) => photo.download_url);
    return photos; 
  } catch (error) {
    console.error('Error fetching random photo details:', error);
    return null;
  }
}