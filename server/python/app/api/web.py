from fastapi import APIRouter, HTTPException
from typing import Optional
from ..models.models import ScrapeRequest, YouTubeAnalyzeRequest, YouTubeCodeExtractRequest
import aiohttp
from bs4 import BeautifulSoup
from urllib.parse import urlparse, parse_qs
import logging
import asyncio
import json
from ..main import fetch_youtube_transcript, genai, logger

router = APIRouter()

@router.post("/scrape")
async def scrape_website(request: ScrapeRequest):
    """Scrape content from a website"""
    try:
        # Validate URL
        parsed_url = urlparse(request.url)
        if not parsed_url.scheme or not parsed_url.netloc:
            raise HTTPException(status_code=400, detail="Invalid URL format")

        # Set up headers to mimic a browser
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }

        async with aiohttp.ClientSession() as session:
            async with session.get(request.url, headers=headers) as response:
                if response.status != 200:
                    raise HTTPException(status_code=response.status, detail=f"Failed to fetch website: {response.status}")

                html = await response.text()

                # Parse HTML with BeautifulSoup
                soup = BeautifulSoup(html, 'html.parser')

                # Remove script and style elements
                for script in soup(["script", "style"]):
                    script.decompose()

                # Get text content
                text = soup.get_text(separator='\\n', strip=True)

                # Clean up text
                lines = (line.strip() for line in text.splitlines())
                chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
                text = '\\n'.join(chunk for chunk in chunks if chunk)

                # Get title
                title = soup.title.string if soup.title else "No title found"

                # Get meta description
                meta_desc = soup.find('meta', attrs={'name': 'description'})
                description = meta_desc['content'] if meta_desc else None

                # Get main content (try to find the main article or content area)
                main_content = None
                for tag in ['article', 'main', '[role="main"]', '#content', '.content']:
                    content = soup.select_one(tag)
                    if content:
                        main_content = content.get_text(separator='\\n', strip=True)
                        break

                return {
                    "title": title,
                    "description": description,
                    "text": text,
                    "main_content": main_content,
                    "url": request.url
                }

    except aiohttp.ClientError as e:
        raise HTTPException(status_code=500, detail=f"Error fetching website: {str(e)}")
    except Exception as e:
        logging.error(f"Error scraping website: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error scraping website: {str(e)}")

@router.post("/youtube/analyze")
async def youtube_analyze(request: YouTubeAnalyzeRequest):
    try:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="GEMINI_API_KEY not found")
        genai.configure(api_key=api_key)

        transcript = await fetch_youtube_transcript(request.youtube_url)
        if not transcript:
            raise HTTPException(status_code=404, detail="Could not retrieve transcript for the video.")

        prompt_text = request.prompt if request.prompt else "Provide a detailed analysis and summary of the following YouTube video transcript for note-taking purposes. Break down key concepts, main points, and any actionable information. Format it clearly."

        full_prompt = f"Video Transcript:\\n\\n{transcript}\\n\\nAnalysis Task:\\n{prompt_text}"

        model = genai.GenerativeModel('gemini-2.0-flash')
        response = await asyncio.to_thread(model.generate_content, full_prompt)

        if not response.text:
            raise HTTPException(status_code=500, detail="AI analysis returned an empty response.")

        return {"analysis_text": response.text}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in YouTube analysis endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error analyzing YouTube video: {str(e)}")

@router.post("/youtube/extract-code")
async def youtube_extract_code(request: YouTubeCodeExtractRequest):
    try:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="GEMINI_API_KEY not found")
        genai.configure(api_key=api_key)

        transcript = await fetch_youtube_transcript(request.youtube_url)
        if not transcript:
            raise HTTPException(status_code=404, detail="Could not retrieve transcript for the video.")

        system_prompt = ('''
            You are an AI assistant specialized in extracting code and instructions from YouTube video transcripts.
            Analyze the provided transcript and perform the following tasks:
            1.  Identify all distinct code blocks mentioned or shown. For each code block:
                *   Infer a filename (e.g., `index.html`, `main.py`, `style.css`). If multiple snippets belong to the same file but are shown at different times, consolidate them under that filename if logical.
                *   Infer the programming language (e.g., `python`, `javascript`, `html`, `css`).
                *   Extract the code exactly as it would appear in a file. Do NOT add any explanations or comments within the code itself unless they are part of the original code in the transcript.
                *   If a part of the code is clearly described but not explicitly shown (e.g., "...and then we close the div tag..."), you can infer and add that missing part if it's unambiguous and essential for completeness.
            2.  Summarize the steps or instructions provided in the video in a clear, point-by-point, or easily readable text format. This should explain how to use or set up the extracted code, or the general process being taught.

            Return the response as a JSON object with two keys:
            *   `extracted_code`: A list of objects, where each object has `filename`, `language`, and `code` keys.
            *   `instructions`: A string containing the summarized steps/instructions.

            If no code is found, `extracted_code` should be an empty list. If no specific instructions are found, `instructions` can be a brief message indicating that.
            Focus on accuracy and completeness of the code. The output should be directly usable by a developer.
            Example JSON output format:
            ```json
            {
              "extracted_code": [
                {
                  "filename": "index.html",
                  "language": "html",
                  "code": "<!DOCTYPE html>\\n<html>\\n<head><title>Test</title></head>\\n<body><h1>Hello</h1></body>\\n</html>"
                },
                {
                  "filename": "main.py",
                  "language": "python",
                  "code": "print(\'Hello from Python!\')"
                }
              ],
              "instructions": "1. Create an HTML file named index.html with the provided content.\\n2. Create a Python file named main.py with the print statement.\\n3. Run the Python script."
            }
            ```
        ''')

        full_prompt = f"{system_prompt}\\n\\nVideo Transcript:\\n\\n{transcript}"

        model = genai.GenerativeModel(
            model_name='gemini-2.0-flash',
            generation_config=genai.types.GenerationConfig(response_mime_type="application/json")
        )
        response = await asyncio.to_thread(model.generate_content, full_prompt)

        if not response.text:
            raise HTTPException(status_code=500, detail="AI code extraction returned an empty response.")

        try:
            # The model is configured to return JSON, so we parse it directly.
            json_response = json.loads(response.text)
            # Validate basic structure
            if (not isinstance(json_response.get('extracted_code'), list) or
               not isinstance(json_response.get('instructions'), str)):
                logger.error(f"AI response is not in the expected JSON format. Response: {response.text}")
                # Fallback: Try to wrap the raw text in a basic structure if it's not JSON
                # This is a very basic fallback, ideally the model always returns valid JSON.
                return {
                    "extracted_code": [],
                    "instructions": "Could not parse AI response. Raw output: " + response.text
                }
            return json_response
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response from AI: {e}. Response: {response.text}")
            # If JSON parsing fails, return the raw text as instructions for debugging or simple cases
            return {
                "extracted_code": [],
                "instructions": "Failed to parse AI response. Raw output: " + response.text
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in YouTube code extraction: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error extracting code from YouTube video: {str(e)}")
