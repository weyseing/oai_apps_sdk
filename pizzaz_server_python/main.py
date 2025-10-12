"""Pizzaz demo MCP server implemented with the Python FastMCP helper.

The server mirrors the Node example in this repository and exposes
widget-backed tools that render the Pizzaz UI bundle. Each handler returns the
HTML shell via an MCP resource and echoes the selected topping as structured
content so the ChatGPT client can hydrate the widget. The module also wires the
handlers into an HTTP/SSE stack so you can run the server with uvicorn on port
8000, matching the Node transport behavior."""

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from typing import Any, Dict, List

import mcp.types as types
from mcp.server.fastmcp import FastMCP
from pydantic import BaseModel, ConfigDict, Field, ValidationError


@dataclass(frozen=True)
class PizzazWidget:
    identifier: str
    title: str
    template_uri: str
    invoking: str
    invoked: str
    html: str
    response_text: str


widgets: List[PizzazWidget] = [
    PizzazWidget(
        identifier="pizza-map",
        title="Show Pizza Map",
        template_uri="ui://widget/pizza-map.html",
        invoking="Hand-tossing a map",
        invoked="Served a fresh map",
        html=(
            "<div id=\"pizzaz-root\"></div>\n"
            "<link rel=\"stylesheet\" href=\"https://persistent.oaistatic.com/"
            "ecosystem-built-assets/pizzaz-0038.css\">\n"
            "<script type=\"module\" src=\"https://persistent.oaistatic.com/"
            "ecosystem-built-assets/pizzaz-0038.js\"></script>"
        ),
        response_text="Rendered a pizza map!",
    ),
    PizzazWidget(
        identifier="pizza-carousel",
        title="Show Pizza Carousel",
        template_uri="ui://widget/pizza-carousel.html",
        invoking="Carousel some spots",
        invoked="Served a fresh carousel",
        html=(
            "<div id=\"pizzaz-carousel-root\"></div>\n"
            "<link rel=\"stylesheet\" href=\"https://persistent.oaistatic.com/"
            "ecosystem-built-assets/pizzaz-carousel-0038.css\">\n"
            "<script type=\"module\" src=\"https://persistent.oaistatic.com/"
            "ecosystem-built-assets/pizzaz-carousel-0038.js\"></script>"
        ),
        response_text="Rendered a pizza carousel!",
    ),
    PizzazWidget(
        identifier="pizza-albums",
        title="Show Pizza Album",
        template_uri="ui://widget/pizza-albums.html",
        invoking="Hand-tossing an album",
        invoked="Served a fresh album",
        html=(
            "<div id=\"pizzaz-albums-root\"></div>\n"
            "<link rel=\"stylesheet\" href=\"https://persistent.oaistatic.com/"
            "ecosystem-built-assets/pizzaz-albums-0038.css\">\n"
            "<script type=\"module\" src=\"https://persistent.oaistatic.com/"
            "ecosystem-built-assets/pizzaz-albums-0038.js\"></script>"
        ),
        response_text="Rendered a pizza album!",
    ),
    PizzazWidget(
        identifier="pizza-list",
        title="Show Pizza List",
        template_uri="ui://widget/pizza-list.html",
        invoking="Hand-tossing a list",
        invoked="Served a fresh list",
        html=(
            "<div id=\"pizzaz-list-root\"></div>\n"
            "<link rel=\"stylesheet\" href=\"https://persistent.oaistatic.com/"
            "ecosystem-built-assets/pizzaz-list-0038.css\">\n"
            "<script type=\"module\" src=\"https://persistent.oaistatic.com/"
            "ecosystem-built-assets/pizzaz-list-0038.js\"></script>"
        ),
        response_text="Rendered a pizza list!",
    ),
    PizzazWidget(
        identifier="pizza-video",
        title="Show Pizza Video",
        template_uri="ui://widget/pizza-video.html",
        invoking="Hand-tossing a video",
        invoked="Served a fresh video",
        html=(
            "<div id=\"pizzaz-video-root\"></div>\n"
            "<link rel=\"stylesheet\" href=\"https://persistent.oaistatic.com/"
            "ecosystem-built-assets/pizzaz-video-0038.css\">\n"
            "<script type=\"module\" src=\"https://persistent.oaistatic.com/"
            "ecosystem-built-assets/pizzaz-video-0038.js\"></script>"
        ),
        response_text="Rendered a pizza video!",
    ),
]


MIME_TYPE = "text/html+skybridge"


WIDGETS_BY_ID: Dict[str, PizzazWidget] = {widget.identifier: widget for widget in widgets}
WIDGETS_BY_URI: Dict[str, PizzazWidget] = {widget.template_uri: widget for widget in widgets}


class PizzaInput(BaseModel):
    """Schema for pizza tools."""

    pizza_topping: str = Field(
        ...,
        alias="pizzaTopping",
        description="Topping to mention when rendering the widget.",
    )

    model_config = ConfigDict(populate_by_name=True, extra="forbid")


mcp = FastMCP(
    name="pizzaz-python",
    sse_path="/mcp",
    message_path="/mcp/messages",
    stateless_http=True,
)


TOOL_INPUT_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "pizzaTopping": {
            "type": "string",
            "description": "Topping to mention when rendering the widget.",
        }
    },
    "required": ["pizzaTopping"],
    "additionalProperties": False,
}


def _resource_description(widget: PizzazWidget) -> str:
    return f"{widget.title} widget markup"


def _tool_meta(widget: PizzazWidget) -> Dict[str, Any]:
    return {
        "openai/outputTemplate": widget.template_uri,
        "openai/toolInvocation/invoking": widget.invoking,
        "openai/toolInvocation/invoked": widget.invoked,
        "openai/widgetAccessible": True,
        "openai/resultCanProduceWidget": True,
        "annotations": {
          "destructiveHint": False,
          "openWorldHint": False,
          "readOnlyHint": True,
        }
    }


def _embedded_widget_resource(widget: PizzazWidget) -> types.EmbeddedResource:
    return types.EmbeddedResource(
        type="resource",
        resource=types.TextResourceContents(
            uri=widget.template_uri,
            mimeType=MIME_TYPE,
            text=widget.html,
            title=widget.title,
        ),
    )


@mcp._mcp_server.list_tools()
async def _list_tools() -> List[types.Tool]:
    return [
        types.Tool(
            name=widget.identifier,
            title=widget.title,
            description=widget.title,
            inputSchema=deepcopy(TOOL_INPUT_SCHEMA),
            _meta=_tool_meta(widget),
        )
        for widget in widgets
    ]


@mcp._mcp_server.list_resources()
async def _list_resources() -> List[types.Resource]:
    return [
        types.Resource(
            name=widget.title,
            title=widget.title,
            uri=widget.template_uri,
            description=_resource_description(widget),
            mimeType=MIME_TYPE,
            _meta=_tool_meta(widget),
        )
        for widget in widgets
    ]


@mcp._mcp_server.list_resource_templates()
async def _list_resource_templates() -> List[types.ResourceTemplate]:
    return [
        types.ResourceTemplate(
            name=widget.title,
            title=widget.title,
            uriTemplate=widget.template_uri,
            description=_resource_description(widget),
            mimeType=MIME_TYPE,
            _meta=_tool_meta(widget),
        )
        for widget in widgets
    ]


async def _handle_read_resource(req: types.ReadResourceRequest) -> types.ServerResult:
    widget = WIDGETS_BY_URI.get(str(req.params.uri))
    if widget is None:
        return types.ServerResult(
            types.ReadResourceResult(
                contents=[],
                _meta={"error": f"Unknown resource: {req.params.uri}"},
            )
        )

    contents = [
        types.TextResourceContents(
            uri=widget.template_uri,
            mimeType=MIME_TYPE,
            text=widget.html,
            _meta=_tool_meta(widget),
        )
    ]

    return types.ServerResult(types.ReadResourceResult(contents=contents))


async def _call_tool_request(req: types.CallToolRequest) -> types.ServerResult:
    widget = WIDGETS_BY_ID.get(req.params.name)
    if widget is None:
        return types.ServerResult(
            types.CallToolResult(
                content=[
                    types.TextContent(
                        type="text",
                        text=f"Unknown tool: {req.params.name}",
                    )
                ],
                isError=True,
            )
        )

    arguments = req.params.arguments or {}
    try:
        payload = PizzaInput.model_validate(arguments)
    except ValidationError as exc:
        return types.ServerResult(
            types.CallToolResult(
                content=[
                    types.TextContent(
                        type="text",
                        text=f"Input validation error: {exc.errors()}",
                    )
                ],
                isError=True,
            )
        )

    topping = payload.pizza_topping
    widget_resource = _embedded_widget_resource(widget)
    meta: Dict[str, Any] = {
        "openai.com/widget": widget_resource.model_dump(mode="json"),
        "openai/outputTemplate": widget.template_uri,
        "openai/toolInvocation/invoking": widget.invoking,
        "openai/toolInvocation/invoked": widget.invoked,
        "openai/widgetAccessible": True,
        "openai/resultCanProduceWidget": True,
    }

    return types.ServerResult(
        types.CallToolResult(
            content=[
                types.TextContent(
                    type="text",
                    text=widget.response_text,
                )
            ],
            structuredContent={"pizzaTopping": topping},
            _meta=meta,
        )
    )


mcp._mcp_server.request_handlers[types.CallToolRequest] = _call_tool_request
mcp._mcp_server.request_handlers[types.ReadResourceRequest] = _handle_read_resource


app = mcp.streamable_http_app()

try:
    from starlette.middleware.cors import CORSMiddleware

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
        allow_credentials=False,
    )
except Exception:
    pass


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("pizzaz_server_python.main:app", host="0.0.0.0", port=8000)
