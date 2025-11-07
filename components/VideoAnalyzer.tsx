import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Textarea } from './ui/Textarea';
import { Button } from './ui/Button';
import { cn } from '../lib/utils';
import { ArrowUpIcon, Paperclip, Loader2, BrainCircuit, FileVideo } from 'lucide-react';
import { analyzeVideo, generateArticle, analyzeTextContent } from '../services/geminiService';

const useAutoResizeTextarea = (minHeight: number, maxHeight?: number) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = `${minHeight}px`; // reset first
    const newHeight = Math.max(
      minHeight,
      Math.min(textarea.scrollHeight, maxHeight ?? Infinity)
    );
    textarea.style.height = `${newHeight}px`;
  }, [minHeight, maxHeight]);

  useEffect(() => {
    if (textareaRef.current) textareaRef.current.style.height = `${minHeight}px`;
  }, [minHeight]);

  return { textareaRef, adjustHeight };
};

export default function VideoAnalyzer() {
  const [mainInput, setMainInput] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [summary, setSummary] = useState('');
  const [article, setArticle] = useState('');
  const [isLoading, setIsLoading] = useState<'summary' | 'article' | null>(null);
  const [error, setError] = useState('');
  const [isThinkingMode, setIsThinkingMode] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { textareaRef, adjustHeight } = useAutoResizeTextarea(150, 600);

  useEffect(() => {
    adjustHeight();
  }, [mainInput, adjustHeight]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setMainInput(text);
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('video/')) {
        setVideoFile(file);
        setMainInput('');
        setError('');
      } else {
        setError('Please select a valid video file.');
        setVideoFile(null);
      }
    }
  };

  const handleGenerateReport = async () => {
    if (!videoFile && !mainInput.trim()) {
      setError('Please paste a transcript or upload a video file to analyze.');
      return;
    }
    setError('');
    setIsLoading('summary');
    setSummary('');
    setArticle('');

    try {
      let result;
      if (videoFile) {
        result = await analyzeVideo(videoFile, mainInput);
      } else {
        result = await analyzeTextContent(mainInput);
      }
      setSummary(result);
    } catch (e) {
      console.error(e);
      setError('Failed to generate the report. Please check the console for details.');
    } finally {
      setIsLoading(null);
    }
  };

  const handleSubmitArticle = async () => {
    if (!summary) {
      setError('Please generate a report first.');
      return;
    }
    setError('');
    setIsLoading('article');
    setArticle('');

    try {
      const result = await generateArticle(summary, isThinkingMode);
      setArticle(result);
    } catch (e) {
      console.error(e);
      setError('Failed to generate the article. Please check the console for details.');
    } finally {
      setIsLoading(null);
    }
  };
  
  const parseMarkdownToHtml = (markdown: string) => {
    const processInlines = (text: string) => {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/_(.*?)_/g, '<em>$1</em>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">$1</a>')
            .replace(/(?<!href=")(?<!href=')https?:\/\/[^\s]+/g, '<a href="$&" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline break-all">$&</a>');
    };

    const cleanMarkdown = markdown.replace(/```markdown\n|```/g, '').trim();
    const blocks = cleanMarkdown.split(/(\r?\n){2,}/);

    return blocks.map(block => {
        const trimmedBlock = block.trim();
        if (!trimmedBlock) return '';

        if (trimmedBlock.startsWith('|')) {
            const rows = trimmedBlock.split(/\r?\n|\r/).filter(row => row.trim().startsWith('|'));
            const separatorIndex = rows.findIndex(row => /\|(?:\s*:?-+:?\s*\|)+/.test(row));
            
            if (separatorIndex > 0) {
                const headers = rows[0].split('|').slice(1, -1).map(cell => cell.trim());
                const bodyRows = rows.slice(separatorIndex + 1);

                const ths = headers.map(h => `<th class="p-3 border-b border-neutral-700 text-left font-semibold bg-neutral-800/50">${processInlines(h)}</th>`).join('');
                
                const trs = bodyRows.map(rowStr => {
                    const cells = rowStr.split('|').slice(1, -1).map(cell => cell.trim());
                    if (cells.length === 0 || cells.every(c => c === '')) return '';
                    const tds = cells.map(cell => `<td class="p-3 border-b border-neutral-800 align-top">${processInlines(cell)}</td>`).join('');
                    return `<tr>${tds}</tr>`;
                }).join('');

                return `
                    <div class="overflow-x-auto my-4 rounded-lg border border-neutral-800">
                        <table class="w-full text-sm">
                            <thead class="bg-neutral-800/50">
                                <tr>${ths}</tr>
                            </thead>
                            <tbody>${trs}</tbody>
                        </table>
                    </div>
                `;
            }
        }
        
        if (trimmedBlock.startsWith('### ')) return `<h3 class="text-lg font-semibold my-2">${processInlines(trimmedBlock.substring(4))}</h3>`;
        if (trimmedBlock.startsWith('## ')) return `<h2 class="text-xl font-semibold my-3 border-b border-neutral-600 pb-1">${processInlines(trimmedBlock.substring(3))}</h2>`;
        if (trimmedBlock.startsWith('# ')) return `<h1 class="text-2xl font-bold my-4">${processInlines(trimmedBlock.substring(2))}</h1>`;
        
        if (trimmedBlock.startsWith('> ')) {
            const quoteContent = trimmedBlock.split(/\r?\n|\r/).map(line => line.replace(/^>\s?/, '')).join(' ');
            return `<blockquote class="border-l-4 border-neutral-600 pl-4 my-4 italic text-neutral-400">${processInlines(quoteContent)}</blockquote>`;
        }

        if (trimmedBlock.match(/^(\*|-)\s/)) {
            const items = trimmedBlock.split(/\r?\n|\r/).map(item => {
                const content = item.replace(/^\s*[-*]\s*/, '');
                return `<li class="pb-1">${processInlines(content)}</li>`;
            }).join('');
            return `<ul class="list-disc list-inside space-y-1 my-2">${items}</ul>`;
        }
        if (trimmedBlock.match(/^\d+\.\s/)) {
            const items = trimmedBlock.split(/\r?\n|\r/).map(item => {
                const content = item.replace(/^\s*\d+\.\s*/, '');
                return `<li class="pb-1">${processInlines(content)}</li>`;
            }).join('');
            return `<ol class="list-decimal list-inside space-y-1 my-2">${items}</ol>`;
        }

        return `<p>${processInlines(trimmedBlock).replace(/\n/g, '<br />')}</p>`;
    }).join('');
  };

  const ResultCard = ({ title, content }: { title: string; content: string }) => (
    <div className="bg-black/60 backdrop-blur-md rounded-xl border border-neutral-700 mt-6 w-full">
        <div className="p-4 border-b border-neutral-700">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
        <div className="p-4 text-neutral-200 text-sm leading-relaxed" 
            dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(content) }}>
        </div>
    </div>
  );
  
  const placeholderText = "Paste a long transcript or other content here...";


  return (
    <div className="flex-1 w-full flex flex-col items-center justify-center p-4">
      <div className="text-center mb-8">
        <h1 className="text-5xl font-bold text-white drop-shadow-lg">
          AI Content Analyzer
        </h1>
        <p className="mt-2 text-neutral-200">
          Paste a transcript or upload a video to generate a detailed, structured report.
        </p>
      </div>

      <div className="w-full max-w-3xl">
        <div className="relative bg-black/60 backdrop-blur-md rounded-xl border border-neutral-700">
          <Textarea
            ref={textareaRef}
            value={mainInput}
            onChange={handleInputChange}
            placeholder={placeholderText}
            className="w-full pl-4 pr-12 py-3 resize-none border-none bg-transparent text-white text-sm focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-neutral-400 min-h-[150px]"
            style={{ overflow: 'hidden' }}
          />
          <div className="flex items-center justify-between p-3 border-t border-neutral-800">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-neutral-700"
                onClick={handleFileClick}
                aria-label="Attach video file"
              >
                <Paperclip className="w-4 h-4" />
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="video/*"
              />
              {videoFile && (
                <div className="flex items-center gap-2 text-xs text-green-400 bg-green-900/50 px-2 py-1 rounded-md">
                    <FileVideo className="w-3 h-3"/>
                    <span>{videoFile.name}</span>
                </div>
              )}
            </div>
            <Button
              onClick={handleGenerateReport}
              disabled={isLoading === 'summary' || (!videoFile && !mainInput.trim())}
              className="flex items-center gap-1 px-3 py-2 rounded-lg transition-colors bg-blue-600 hover:bg-blue-500 text-white disabled:bg-neutral-700 disabled:text-neutral-400 disabled:cursor-not-allowed"
            >
              {isLoading === 'summary' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowUpIcon className="w-4 h-4" />
              )}
              <span className="text-sm font-medium">Generate Report</span>
            </Button>
          </div>
        </div>

        {error && <div className="mt-4 text-center text-red-400 bg-red-900/50 p-3 rounded-lg">{error}</div>}

        {isLoading === 'summary' && (
            <div className="text-center text-neutral-300 mt-6 flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Analyzing content, this may take a few moments...</span>
            </div>
        )}

        {summary && (
          <>
            <ResultCard title="Generated Report" content={summary} />
            <div className="mt-6 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 bg-black/60 backdrop-blur-md rounded-xl border border-neutral-700">
              <div className="flex items-center gap-3">
                <label htmlFor="thinking-mode" className="flex items-center gap-2 cursor-pointer text-sm font-medium text-white">
                    <BrainCircuit className="w-5 h-5 text-purple-400"/>
                    Enable Thinking Mode
                </label>
                <input
                    id="thinking-mode"
                    type="checkbox"
                    checked={isThinkingMode}
                    onChange={(e) => setIsThinkingMode(e.target.checked)}
                    className="w-4 h-4 text-purple-600 bg-neutral-700 border-neutral-600 rounded focus:ring-purple-500"
                />
              </div>

              <Button
                onClick={handleSubmitArticle}
                disabled={isLoading === 'article'}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors bg-purple-600 hover:bg-purple-500 text-white disabled:bg-neutral-700 disabled:text-neutral-400 disabled:cursor-not-allowed"
              >
                {isLoading === 'article' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : null}
                Generate SEO Article
              </Button>
            </div>
          </>
        )}
        
        {isLoading === 'article' && (
            <div className="text-center text-neutral-300 mt-6 flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Generating article...</span>
            </div>
        )}

        {article && <ResultCard title="Generated SEO Article" content={article} />}
      </div>
    </div>
  );
}