# API contract: `GET /api/gallery`

This is the only interface between the public frontend and the backend.
The frontend must not depend on anything else (storage, file names, folder layout).

## Request

```
GET /api/gallery
Accept: application/json
```

## Response `200 OK`

```json
{
  "categories": [
    {
      "id": "landscape",
      "title": "Landscape",
      "images": [
        {
          "id": "a7f3c201",
          "title": "Fog over the lake",
          "description": null,
          "thumb": "/img/landscape/a7f3c201-thumb.jpg",
          "full": "/img/landscape/a7f3c201-full.jpg",
          "width": 2400,
          "height": 1600,
          "thumbWidth": 600,
          "thumbHeight": 400
        }
      ]
    }
  ]
}
```

## Rules

| Field | Required | Meaning |
|---|---|---|
| `categories` | yes | Array. Its order is the category display order. May be empty. |
| `categories[].id` | yes | Stable, URL-safe identifier, e.g. `landscape`. |
| `categories[].title` | yes | Display name. |
| `categories[].images` | yes | Array. Its order is the display order inside the category. May be empty. |
| `images[].id` | yes | Stable identifier. An image with a given id never changes its content. |
| `images[].thumb` | yes | URL of the thumbnail (about 600 px on the long edge). Opaque to the frontend. |
| `images[].full` | yes | URL of the large image (about 2400 px on the long edge). Opaque to the frontend. |
| `images[].title` | no | Caption title, or `null`. Plain text, never HTML. |
| `images[].description` | no | Caption text, or `null`. Plain text, never HTML. |
| `images[].width`, `height` | no | Pixel size of `full`. |
| `images[].thumbWidth`, `thumbHeight` | no | Pixel size of `thumb`. Used to reserve space while loading. |
| `images[].position` | no | CSS background position for the viewer, e.g. `"top center"`. Default `center`. |

- The frontend treats `thumb` and `full` as opaque strings. It never builds image URLs itself.
- URLs should be same-origin relative paths (for example `/img/...`).
- Unknown fields must be ignored by the frontend, so the backend can add fields without breaking it.

## Errors

Any non-2xx status means "gallery unavailable". The frontend shows a friendly message and does not retry.

## Caching

- `/api/gallery`: short or no caching, so admin changes appear quickly.
- Image URLs: may be cached for a long time (`immutable`), because an id never changes its content.
