# Character Card Repository API Documentation

This document provides instructions on how to use the API for this character card repository. The API is designed to be simple and is based on serving static JSON files and character assets.

This allows anyone to easily host their own private or public character repository on any static file hosting service (like Vercel, GitHub Pages, Netlify, etc.).

## Base URL

The API endpoints are relative to the base URL where this repository is hosted. For example, if you deploy this project to `https://my-card-repo.vercel.app`, that will be your base URL.

---

## Endpoints

### 1. Get Character List

This endpoint retrieves the main index file containing a list of all available character cards and their metadata.

- **Method**: `GET`
- **Endpoint**: `/index.json`
- **Full URL Example**: `https://my-card-repo.vercel.app/index.json`

#### Response Body (`200 OK`)

A JSON object with the following structure:

```json
{
  "repository_version": "1.0.0",
  "last_updated": "2025-09-04T12:00:00Z",
  "characters": [
    {
      "id": "unique-character-id-001",
      "name": "AI Assistant",
      "author": "Roo",
      "version": "1.1",
      "description": "A helpful and knowledgeable AI assistant.",
      "tags": ["Assistant", "Knowledge", "Sci-Fi"],
      "first_mes": "Hello! I'm Roo, your personal AI assistant. How can I help you today?",
      "avatar_url": "characters/unique-character-id-001/avatar.webp",
      "card_url": "characters/unique-character-id-001/card.png",
      "last_updated": "2025-09-03T18:00:00Z"
    }
    // ... more character objects
  ]
}
```

### 2. Download Character Card

This endpoint allows you to download the actual character card `.png` file.

- **Method**: `GET`
- **Endpoint**: `/{card_url}`
- **Details**: The `{card_url}` is the relative path provided in the `card_url` field of a character object from the `index.json` file.
- **Full URL Example**: `https://my-card-repo.vercel.app/characters/unique-character-id-001/card.png`

#### Response Body (`200 OK`)

The raw PNG image file of the character card.

### 3. Download Character Avatar

This endpoint allows you to download the character's avatar image.

- **Method**: `GET`
- **Endpoint**: `/{avatar_url}`
- **Details**: The `{avatar_url}` is the relative path provided in the `avatar_url` field of a character object from the `index.json` file.
- **Full URL Example**: `https://my-card-repo.vercel.app/characters/unique-character-id-001/avatar.webp`

#### Response Body (`200 OK`)

The character's avatar image file (e.g., WebP, PNG).

---

## Client Implementation Guide

To use this API in an application (like SillyTavern):

1.  **Fetch the Index**: Make a `GET` request to `/index.json`.
2.  **Parse and Display**: Parse the JSON response. Use the `characters` array to display a list of available characters in your UI. You can implement search and filtering locally on this data.
3.  **Handle Downloads**: When a user chooses to download a character:
    -   Use the `card_url` from the selected character object to construct the full download URL.
    -   Make a `GET` request to that URL to download the `.png` file.
    -   (Optional) Use the `avatar_url` to fetch and display the character's avatar.

This static API design ensures high performance and low cost, as it doesn't require any server-side computation for read operations.
