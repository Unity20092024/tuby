import { GoogleGenAI, Part } from '@google/genai';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });
const videoAnalysisModel = 'gemini-2.5-pro';
const textModel = 'gemini-2.5-flash';

const convertFileToGenerativePart = (file: File): Promise<Part> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const mimeType = file.type;
      const data = result.split(',')[1];
      resolve({ inlineData: { mimeType, data } });
    };
    reader.onerror = (error) => reject(error);
  });
};

export const analyzeVideo = async (videoFile: File, userPrompt: string): Promise<string> => {
  const videoPart = await convertFileToGenerativePart(videoFile);
  const systemPrompt = `Analyze this video in detail. Your primary goal is to act as a 'Learning Machine'. Extract all important key points and provide a deep understanding of the speaker's message. Identify any websites mentioned, including their URLs and a brief description. Pay close attention to any instructional content or key information being taught. Finally, compile all this information into a comprehensive, well-structured summary. If the user provides additional instructions, prioritize them.`;

  const finalPrompt = userPrompt ? `${systemPrompt}\n\nUser Instructions: ${userPrompt}` : systemPrompt;

  const contents = {
    parts: [videoPart, { text: finalPrompt }],
  };

  try {
    const response = await ai.models.generateContent({
        model: videoAnalysisModel,
        contents: contents,
    });
    return response.text;
  } catch (error) {
    console.error("Error in analyzeVideo:", error);
    throw new Error("Failed to generate content from video.");
  }
};

const REPORT_SYSTEM_INSTRUCTION = `
You are an AI assistant tasked with creating a "Video Analysis Report" from a user-provided transcript. Your goal is to process the content to generate a comprehensive summary, with a **primary focus on accurately finding and extracting all mentioned URLs and resources.**

Your output **must** be in Markdown format and follow this structure precisely:

# Video Analysis Report

## Video Identification
- **Title**: [Infer a descriptive title from the transcript. If not possible, write "N/A"]
- **Source**: User-Provided Transcript

## Executive Summary
[Write a concise 3-4 sentence overview of the entire content.]

## Detailed Breakdown
[Segment the content into logical chapters or topics. Use markdown headings for each segment.]
- [Key point from segment 1]
- [Key point from segment 1]

## Key Insights
[List the most important, high-level insights from the text.]
- [Insight 1]
- [Insight 2]
- [Insight 3]

## Mentioned URLs & Resources
[Create a markdown table. **This is the most critical step.** You must meticulously scan the entire transcript to find every mentioned website, tool, or resource. If a URL is explicitly stated, use it. **If a resource is named but no URL is given (e.g., "Skip Grants", "Gusto"), you MUST use your search tool to find the official URL.** Your primary goal is to provide a direct, clickable link for the user. If you cannot find a definitive URL after searching, and only then, you may write "Official URL not found". Do not miss any resource.]
| Resource Name | URL | Context |
|---------------|-----|---------|
| [Resource 1]  | [The direct URL you found]  | [Explain why this resource was mentioned] |

## Actionable Takeaways
[List clear, actionable steps or takeaways for the reader.]
- [Action 1]
- [Action 2]

## Additional Notes
- **Speaker Style**: [Describe the speaker's tone and style based on the text (e.g., educational, motivational, technical).]
- **Target Audience**: [Describe the likely audience for this content.]
`;

export const analyzeTextContent = async (textContent: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: textContent,
            config: {
                systemInstruction: REPORT_SYSTEM_INSTRUCTION,
                tools: [{googleSearch: {}}],
            }
        });
        
        let reportText = response.text;
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;

        if (groundingChunks && groundingChunks.length > 0) {
            const sources = groundingChunks
                .map(chunk => chunk.web)
                .filter(web => web?.uri && web.uri.trim() !== '')
                .map(web => `[${web.title || web.uri}](${web.uri})`);
            
            if (sources.length > 0) {
                const uniqueSources = [...new Set(sources)];
                reportText += `\n\n## Sources\n${uniqueSources.join('\n')}`;
            }
        }

        return reportText;
    } catch (error) {
        console.error("Error in analyzeTextContent:", error);
        throw new Error("Failed to generate report from text content.");
    }
};

export const generateArticle = async (summary: string, isThinkingMode: boolean): Promise<string> => {
  const prompt = `Based on the following summary of a video, write a full, highly detailed, SEO-friendly article. The article should be engaging, well-structured with headings and subheadings, and optimized for search engines.\n\n--- VIDEO SUMMARY ---\n${summary}`;
  
  const config = isThinkingMode ? {
      thinkingConfig: { thinkingBudget: 24576 }
  } : {};

  try {
    const response = await ai.models.generateContent({
        model: textModel,
        contents: prompt,
        config: config
    });
    return response.text;
  } catch (error) {
    console.error("Error in generateArticle:", error);
    throw new Error("Failed to generate article from summary.");
  }
};