'use client';

import * as React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Wand2 } from "lucide-react";

// Types for props
interface FeedbackTextareaProps extends React.ComponentProps<typeof Textarea> {
  onToneChange?: (toneScore: number) => void;
  onContentChange?: (content: string) => void;
  'data-question-text'?: string;
  'data-question-description'?: string; // Add custom attribute
}

// Type for tone options
type ToneOption = "friendly" | "assertive" | "formal" | "informal";

const FeedbackTextarea = React.forwardRef<HTMLTextAreaElement, FeedbackTextareaProps>(
  ({ className, value, onChange, onToneChange, onContentChange, ...props }, ref) => {
    // State for tone analysis
    console.log(onContentChange);
    const [toneScore, setToneScore] = useState<number | null>(null); // 0-100, 0 being friendly, 100 being aggressive
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    
    // State for tone adjustment modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTone, setSelectedTone] = useState<ToneOption | null>(null);
    const [generatedText, setGeneratedText] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    
    // New state for tone scores in the modal
    const [originalToneScore, setOriginalToneScore] = useState<number | null>(null);
    const [generatedToneScore, setGeneratedToneScore] = useState<number | null>(null);
    const [isAnalyzingOriginal, setIsAnalyzingOriginal] = useState(false);
    const [isAnalyzingGenerated, setIsAnalyzingGenerated] = useState(false);
    
    // References to track component state
    const isMounted = useRef(true);
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);
    const currentValue = useRef<string>(typeof value === 'string' ? value : '');
    const skipNextAnalysis = useRef<boolean>(false);
    
    // Add cleanup on unmount
    useEffect(() => {
      return () => {
        isMounted.current = false;
        if (debounceTimer.current) {
          clearTimeout(debounceTimer.current);
        }
      };
    }, []);
    
    // Keep track of question changes
    const previousValueRef = useRef<string>(typeof value === 'string' ? value : '');
    
    // Reset tone state when question changes
    useEffect(() => {
      const currentValString = typeof value === 'string' ? value : '';
      const previousValString = previousValueRef.current;
      
      // If the value has completely changed (not just edited), reset all state
      if (currentValString !== previousValString && 
          (currentValString.length === 0 || 
           previousValString.length === 0 ||
           !currentValString.includes(previousValString.substring(0, 20)) && 
           !previousValString.includes(currentValString.substring(0, 20)))) {
        // console.log("Value completely changed, resetting tone state");
        setToneScore(null);
        setSelectedTone(null);
        setGeneratedText("");
        setIsGenerating(false);
        setIsModalOpen(false);
        setOriginalToneScore(null);
        setGeneratedToneScore(null);
        setIsAnalyzingOriginal(false);
        setIsAnalyzingGenerated(false);
      }
      
      // Update current value reference and previous value reference
      currentValue.current = currentValString;
      previousValueRef.current = currentValString;
    }, [value]);
    
    // Force tone dialog to close and reset if we get stuck
    useEffect(() => {
      if (isGenerating) {
        // Set a timeout to force loading to stop if it takes too long
        const timeoutId = setTimeout(() => {
          if (isMounted.current && isGenerating) {
            console.log("Force stopping spinner after timeout");
            setIsGenerating(false);
            
            // If we have no generated text by now, use the original
            if (!generatedText && currentValue.current) {
              setGeneratedText(currentValue.current);
            }
          }
        }, 5000); // 5 second timeout
        
        return () => clearTimeout(timeoutId);
      }
    }, [isGenerating, generatedText]);
    
    // Memoize the analyzeTone function to prevent recreation on each render
    const analyzeTone = useCallback(async (text: string) => {
      if (isAnalyzing || !text || !isMounted.current || skipNextAnalysis.current) {
        skipNextAnalysis.current = false;
        return;
      }
      
      setIsAnalyzing(true);
      try {
        // API call for tone analysis
        const response = await fetch('/api/analyze-tone', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text }),
        });
        
        if (!isMounted.current) return;

        const responseText = await response.text();
        // console.log("Raw tone analysis response:", responseText);
        
        try {
          const data = JSON.parse(responseText);
          console.log("Parsed tone data:", data);
          
          if (data && typeof data.toneScore === 'number') {
            console.log(`Setting tone score to ${data.toneScore}`);
            setToneScore(data.toneScore);
            
            // Only call onToneChange if component is still mounted
            if (isMounted.current && onToneChange) {
              onToneChange(data.toneScore);
            }
          } else {
            console.error('No valid tone score in response:', data);
            if (isMounted.current) {
              setToneScore(50); // Neutral fallback
              if (onToneChange) onToneChange(50);
            }
          }
        } catch (e) {
          console.error("Failed to parse tone response:", e);
          if (isMounted.current) {
            setToneScore(50); // Neutral fallback
            if (onToneChange) onToneChange(50);
          }
        }
      } catch (error) {
        console.error('Error analyzing tone:', error);
        if (isMounted.current) {
          setToneScore(50); // Neutral fallback
          if (onToneChange) onToneChange(50);
        }
      } finally {
        if (isMounted.current) {
          setIsAnalyzing(false);
        }
      }
    }, [onToneChange]);
    
    // New function to analyze tone for modal display
    // Use direct fetch implementation with forced state updates
    const handleToneAnalysis = useCallback((text: string, isOriginal: boolean) => {
      // Skip if not enough text
      if (!text || text.length < 20) {
        return;
      }
      
      // Start with clean state
      if (isOriginal) {
        // console.log("DIRECT: Setting isAnalyzingOriginal to TRUE");
        setIsAnalyzingOriginal(true);
        setOriginalToneScore(null);
      } else {
        // console.log("DIRECT: Setting isAnalyzingGenerated to TRUE");
        setIsAnalyzingGenerated(true);
        setGeneratedToneScore(null);
      }
      
      // Force UI to reset after a maximum time no matter what
      const forceResetTimeout = setTimeout(() => {
        if (isOriginal) {
          console.log("DIRECT: FORCE RESET - Original tone analysis took too long");
          setIsAnalyzingOriginal(false);
          setOriginalToneScore(50); // Default fallback
        } else {
          console.log("DIRECT: FORCE RESET - Generated tone analysis took too long");
          setIsAnalyzingGenerated(false);
          setGeneratedToneScore(50); // Default fallback
        }
      }, 3000); // Shorter timeout for better UX
      
      // Make the API request
      fetch('/api/analyze-tone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      })
      .then(response => response.text())
      .then(responseText => {
        // Clear the force reset timeout since we got a response
        clearTimeout(forceResetTimeout);
        
        // console.log(`DIRECT: Got tone analysis response: ${responseText}`);
        
        try {
          const data = JSON.parse(responseText);
          
          if (data && typeof data.toneScore === 'number') {
            const score = data.toneScore;
            // console.log(`DIRECT: Valid tone score: ${score}`);
            
            // Schedule multiple state updates to handle race conditions
            setTimeout(() => {
              if (isOriginal) {
                // console.log("DIRECT: FIRST Setting isAnalyzingOriginal to FALSE");
                setIsAnalyzingOriginal(false);
                setOriginalToneScore(score);
              } else {
                // console.log("DIRECT: FIRST Setting isAnalyzingGenerated to FALSE");
                setIsAnalyzingGenerated(false);
                setGeneratedToneScore(score);
              }
              
              // Force another update after a short delay as a backup
              setTimeout(() => {
                if (isOriginal) {
                  // console.log("DIRECT: SECOND Setting isAnalyzingOriginal to FALSE");
                  setIsAnalyzingOriginal(false);
                } else {
                  // console.log("DIRECT: SECOND Setting isAnalyzingGenerated to FALSE");
                  setIsAnalyzingGenerated(false);
                }
              }, 100);
            }, 0);
          } else {
            // Handle invalid score
            console.error('DIRECT: No valid tone score in response');
            if (isOriginal) {
              setIsAnalyzingOriginal(false);
              setOriginalToneScore(50);
            } else {
              setIsAnalyzingGenerated(false);
              setGeneratedToneScore(50);
            }
          }
        } catch (e) {
          // Handle parsing error
          console.error('DIRECT: Failed to parse tone response:', e);
          if (isOriginal) {
            setIsAnalyzingOriginal(false);
            setOriginalToneScore(50);
          } else {
            setIsAnalyzingGenerated(false);
            setGeneratedToneScore(50);
          }
        }
      })
      .catch(error => {
        // Handle fetch error
        clearTimeout(forceResetTimeout);
        console.error('DIRECT: Error fetching tone analysis:', error);
        
        if (isOriginal) {
          setIsAnalyzingOriginal(false);
          setOriginalToneScore(50);
        } else {
          setIsAnalyzingGenerated(false);
          setGeneratedToneScore(50);
        }
      });
    }, []);
    
    // Effect to analyze tone when modal opens
    useEffect(() => {
      if (isModalOpen && !selectedTone) {
        const originalText = currentValue.current;
        if (originalText && originalText.length >= 20) {
          console.log("Modal opened, starting tone analysis for original text");
          // Reset tone score first to ensure UI updates
          setOriginalToneScore(null);
          
          // Use direct fetch version for more reliability
          handleToneAnalysis(originalText, true);
        }
      }
    }, [isModalOpen, selectedTone, handleToneAnalysis]);
    
    // Effect to analyze generated text tone when available
    useEffect(() => {
      if (generatedText && !isGenerating && selectedTone) {
        // Use direct fetch version for more reliability
        handleToneAnalysis(generatedText, false);
      }
    }, [generatedText, isGenerating, selectedTone, handleToneAnalysis]);
    
    // Debounced analysis effect
    useEffect(() => {
      const valueToAnalyze = currentValue.current;
      
      // Only analyze if we have enough content
      if (valueToAnalyze.length >= 20 && !isAnalyzing) {
        // Clear any existing timer
        if (debounceTimer.current) {
          clearTimeout(debounceTimer.current);
        }
        
        // Set new timer for debounced analysis
        debounceTimer.current = setTimeout(() => {
          if (isMounted.current) {
            // console.log("Starting tone analysis for text:", valueToAnalyze.substring(0, 50) + "...");
            analyzeTone(valueToAnalyze);
          }
        }, 800); // Slightly longer debounce of 800ms
      } else if (valueToAnalyze.length < 20 && toneScore !== null) {
        // Reset tone score if text is too short
        setToneScore(null);
      }
      
      // Cleanup timer on effect cleanup
      return () => {
        if (debounceTimer.current) {
          clearTimeout(debounceTimer.current);
          debounceTimer.current = null;
        }
      };
    // Deliberately omitting dependencies that would cause frequent re-runs
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, isAnalyzing]);
    
    // Handle tone selection - completely rewritten to be more direct
    const handleToneSelect = useCallback((tone: ToneOption) => {
      // Clear any previous state
      setSelectedTone(tone);
      setGeneratedText("");
      setIsGenerating(true);
      setGeneratedToneScore(null);
      
      // console.log(`Selected tone: ${tone}, starting generation...`);
      
      // Get the text to transform
      const textToTransform = currentValue.current;
      
      // Get parent component props to find question context if available
      const questionContext = props['data-question-text'] || '';
      const questionContextDescription = props['data-question-description'] || '';
      
      // Set a global timeout to force loading to stop after 8 seconds
      const timeoutId = setTimeout(() => {
        console.log("EMERGENCY: Force timeout triggered");
        setIsGenerating(false); 
        setGeneratedText(textToTransform || "");
      }, 8000);
      
      // Immediately start the API request
      fetch('/api/adjust-tone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: textToTransform,
          tone: tone,
          questionContext: questionContext,
          questionContextDescription: questionContextDescription
        }),
      })
      .then(response => response.text())
      .then(text => {
        // console.log("Raw response received: ", text.substring(0, 100) + "...");
        clearTimeout(timeoutId);
        
        try {
          const data = JSON.parse(text);
          console.log("Parsed data received");
          
          if (data && typeof data.generatedText === 'string') {
            console.log("Setting generated text");
            setGeneratedText(data.generatedText);
          } else {
            console.error("Invalid response format, using original text");
            setGeneratedText(textToTransform || "");
          }
        } catch (e) {
          console.error("Failed to parse response", e);
          setGeneratedText(textToTransform || "");
        } finally {
          console.log("FINALLY: Setting isGenerating to false");
          setIsGenerating(false);
        }
      })
      .catch(err => {
        console.error("Fetch error", err);
        clearTimeout(timeoutId);
        setGeneratedText(textToTransform || "");
        setIsGenerating(false);
      });
      
    }, [props]);
    
    // Handle applying generated text
    const handleApplyGeneratedText = useCallback(() => {
      if (!generatedText || !onChange) {
        setIsModalOpen(false);
        return;
      }
      
      // Mark to skip the next analysis to prevent loops
      skipNextAnalysis.current = true;
      
      // Update the current value ref to match what we're about to set
      currentValue.current = generatedText;
      
      // Create a synthetic event to mimic textarea change
      const event = {
        target: { value: generatedText }
      } as React.ChangeEvent<HTMLTextAreaElement>;
      
      // Call the onChange handler
      onChange(event);
      
      // Also update the tone score if we have one
      if (generatedToneScore !== null && onToneChange) {
        onToneChange(generatedToneScore);
      }
      
      // Close the modal
      setIsModalOpen(false);
    }, [generatedText, onChange, generatedToneScore, onToneChange]);
    
    // Handle regenerating text - simplified direct implementation
    const handleRegenerate = useCallback(() => {
      if (!selectedTone) return;
      
      // Reset state
      setGeneratedText("");
      setIsGenerating(true);
      setGeneratedToneScore(null);
      
      console.log(`Regenerating text with tone: ${selectedTone}`);
      
      // Get the text to transform
      const textToTransform = currentValue.current;
      
      // Set a global timeout to force loading to stop after 8 seconds
      const timeoutId = setTimeout(() => {
        console.log("EMERGENCY REGEN: Force timeout triggered");
        setIsGenerating(false); 
        setGeneratedText(textToTransform || "");
      }, 8000);
      
      // Directly start the API request
      fetch('/api/adjust-tone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: textToTransform,
          tone: selectedTone 
        }),
      })
      .then(response => response.text())
      .then(text => {
        // console.log("REGEN: Raw response received: ", text.substring(0, 100) + "...");
        clearTimeout(timeoutId);
        
        try {
          const data = JSON.parse(text);
          // console.log("REGEN: Parsed data received");
          
          if (data && typeof data.generatedText === 'string') {
            console.log("REGEN: Setting generated text");
            setGeneratedText(data.generatedText);
          } else {
            console.error("REGEN: Invalid response format, using original text");
            setGeneratedText(textToTransform || "");
          }
        } catch (e) {
          console.error("REGEN: Failed to parse response", e);
          setGeneratedText(textToTransform || "");
        } finally {
          console.log("REGEN FINALLY: Setting isGenerating to false");
          setIsGenerating(false);
        }
      })
      .catch(err => {
        console.error("REGEN: Fetch error", err);
        clearTimeout(timeoutId);
        setGeneratedText(textToTransform || "");
        setIsGenerating(false);
      });
      
    }, [selectedTone]);
    
    // Calculate tone indicator position
    // const getToneIndicatorPosition = useCallback((score: number | null) => {
    //   // console.log(`Calculating position for score: ${score}`);
    //   if (score === null) return '50%'; // Center by default
    //   return `${score}%`;
    // }, []);
    
    // Get tone label based on score
    const getToneLabel = useCallback((score: number | null) => {
      if (score === null) return '';
      if (score < 25) return 'Friendly';
      if (score < 50) return 'Neutral';
      if (score < 75) return 'Assertive';
      return 'Aggressive';
    }, []);
    
    // Handle local change
    const handleLocalChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
      // Update our internal reference
      currentValue.current = e.target.value;
      
      if (onChange) {
        onChange(e);
      }
    }, [onChange]);

    // Render the tone indicator
    // const renderToneIndicator = useCallback((score: number | null, isLoading: boolean) => {
    //   return (
    //     <div className="mt-2 relative">
    //       <div className="h-1 w-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-full"></div>
    //       {score !== null && (
    //         <div 
    //           className="absolute top-0 w-2 h-2 bg-white border border-slate-400 rounded-full transform -translate-y-1/2"
    //           style={{ left: getToneIndicatorPosition(score) }}
    //         ></div>
    //       )}
    //       <div className="flex justify-between text-xs text-slate-500 mt-1">
    //         <span>Friendly</span>
    //         <span>{getToneLabel(score)}</span>
    //         <span>Aggressive</span>
    //       </div>
    //     </div>
    //   );
    // }, [getToneIndicatorPosition, getToneLabel]);

    return (
      <div className="relative">
        {/* Textarea Component */}
        <Textarea
          ref={ref}
          value={value}
          onChange={handleLocalChange}
          className={cn("pr-10", className)}
          {...props}
        />
        
        {/* Tone Adjuster Button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-8 w-8 text-slate-400 hover:text-cerulean"
          onClick={() => {
            // Reset all modal state before opening
            setSelectedTone(null);
            setGeneratedText("");
            setIsGenerating(false);
            setOriginalToneScore(null);
            setGeneratedToneScore(null);
            setIsModalOpen(true);
          }}
          title="Adjust tone"
        >
          <Wand2 className="h-4 w-4" />
        </Button>
        
        {/* Tone Indicator (only show if we have a score) */}
        {/* {toneScore !== null && (
          <div className="mt-2 relative items-center">
            <div className="h-2 w-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-full"></div>
            <div 
              className="absolute shadow-md top-1 w-4 h-4 bg-white border border-slate-300 rounded-full transform -translate-y-1/2"
              style={{ left: getToneIndicatorPosition(toneScore) }}
            ></div>
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>Friendly</span>
              <span>{getToneLabel(toneScore)}</span>
              <span>Aggressive</span>
            </div>
          </div>
        )} */}
        
        {/* Tone Adjustment Modal */}
        <Dialog open={isModalOpen} onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) {
            // Reset state when dialog closes
            setSelectedTone(null);
            setGeneratedText("");
            setIsGenerating(false);
            setOriginalToneScore(null);
            setGeneratedToneScore(null);
          }
        }}>
          <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle>Adjust Your Tone</DialogTitle>
              <DialogDescription>
                Choose a tone for your message or use the suggested version below.
              </DialogDescription>
            </DialogHeader>
            
            {/* Original Text Tone Analysis */}
            {!selectedTone && currentValue.current.length >= 20 && (
              <div className="py-2">
                <h4 className="text-sm font-medium mb-2 flex items-center">
                  Current Tone: 
                  {isAnalyzingOriginal 
                    ? <span className="ml-2 inline-flex items-center text-sm text-slate-500">
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        Analyzing...
                      </span>
                    : <span data-tone-score={originalToneScore} className="ml-2 font-medium">{getToneLabel(originalToneScore) || 'Neutral'}</span>
                  }
                </h4>
                <div className="mt-2 relative items-center">
                  <div className="h-2 w-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-full"></div>
                  {!isAnalyzingOriginal && originalToneScore !== null && (
                    <div 
                      className="absolute shadow-md top-1 w-4 h-4 bg-white border border-slate-300 rounded-full transform -translate-y-1/2"
                      style={{ left: `${originalToneScore}%` }}
                    ></div>
                  )}
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>Friendly</span>
                    <span>Neutral</span>
                    <span>Aggressive</span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Tone Selection Buttons */}
            {!selectedTone && (
              <div className="grid grid-cols-2 gap-4 py-4">
                <Button 
                  onClick={() => handleToneSelect("friendly")} 
                  variant="outline"
                  className="flex flex-col py-3 h-auto"
                >
                  <p>
                    Friendly<br/>
                    <span className="text-xs text-slate-500">Warm, approachable, supportive</span>
                  </p>
                </Button>
                <Button 
                  onClick={() => handleToneSelect("assertive")} 
                  variant="outline"
                  className="flex flex-col py-3 h-auto"
                >
                  <p>
                    Assertive<br/>
                    <span className="text-xs text-slate-500">Confident, direct, clear</span>
                  </p>
                </Button>
                <Button 
                  onClick={() => handleToneSelect("formal")} 
                  variant="outline"
                  className="flex flex-col py-3 h-auto"
                >
                  <p>
                    Formal<br/>
                    <span className="text-xs text-slate-500">Professional, structured, precise</span>
                  </p>
                </Button>
                <Button 
                  onClick={() => handleToneSelect("informal")} 
                  variant="outline"
                  className="flex flex-col py-3 h-auto"
                >
                  <p>
                    Informal<br/>
                    <span className="text-xs text-slate-500">Casual, conversational, relaxed</span>
                  </p>
                </Button>
              </div>
            )}
            
            {/* Generated Text Area */}
            {selectedTone && (
              <div className="py-4">
                <h4 className="text-sm font-medium mb-2 capitalize">{selectedTone} Version:</h4>
                {isGenerating ? (
                  <div className="flex flex-col justify-center items-center h-36 bg-slate-50 rounded-md">
                    <Loader2 className="h-6 w-6 animate-spin text-cerulean mb-2" />
                    <p className="text-sm text-slate-500">Generating {selectedTone} version...</p>
                    <p className="text-xs text-slate-400 mt-2">This may take a few seconds</p>
                  </div>
                ) : (
                  <>
                    {generatedText ? (
                      <>
                        <Textarea
                          value={generatedText}
                          onChange={(e) => setGeneratedText(e.target.value)}
                          className="min-h-[150px]"
                        />
                        
                        {/* Generated Text Tone Analysis */}
                        {generatedText.length >= 20 && (
                          <div className="mt-2">
                            <h4 className="text-sm font-medium mb-1 flex items-center mt-4">
                              Generated Text Tone: 
                              {isAnalyzingGenerated
                                ? <span className="ml-2 inline-flex items-center text-sm text-slate-500">
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                    Analyzing...
                                  </span>
                                : <span data-tone-score={generatedToneScore} className="ml-2 font-medium">{getToneLabel(generatedToneScore) || 'Neutral'}</span>
                              }
                            </h4>
                            <div className="mt-2 relative items-center">
                              <div className="h-2 w-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-full"></div>
                              {!isAnalyzingGenerated && generatedToneScore !== null && (
                                <div 
                                  className="absolute shadow-md top-1 w-4 h-4 bg-white border border-slate-300 rounded-full transform -translate-y-1/2"
                                  style={{ left: `${generatedToneScore}%` }}
                                ></div>
                              )}
                              
                              <div className="flex justify-between text-xs text-slate-500 mt-1">
                                <span>Friendly</span>
                                <span>Neutral</span>
                                <span>Aggressive</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex justify-center items-center h-36 bg-slate-50 rounded-md">
                        <p className="text-slate-500">No text generated. Please try again.</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            
            <DialogFooter className="flex flex-row justify-between sm:justify-between">
              {selectedTone && !isGenerating && (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleRegenerate}
                >
                  Regenerate
                </Button>
              )}
              <div className="flex space-x-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                {selectedTone && !isGenerating && (
                  <Button 
                    type="button" 
                    onClick={handleApplyGeneratedText}
                    disabled={isGenerating || !generatedText}
                  >
                    Use This!
                  </Button>
                )}
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }
);

FeedbackTextarea.displayName = "FeedbackTextarea";

export { FeedbackTextarea };