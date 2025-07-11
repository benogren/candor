// src/components/VoiceVisualization.tsx - Event-driven animation (more reliable)
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, BotMessageSquare } from 'lucide-react';
import { SpeakerLoudIcon } from '@radix-ui/react-icons';

interface VoiceVisualizationProps {
  isListening?: boolean;
  isSpeaking?: boolean;
  isIdle?: boolean;
  audioStream?: MediaStream; // Only for microphone
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'pulse' | 'waveform' | 'ripple';
  sensitivity?: number;
  // New props for better AI animation
  aiIntensity?: number; // 0-100, driven by conversation events
  conversationActive?: boolean;
  recipientName?: string; // Optional, for displaying in status text
}

// Type declaration for webkit audio context
interface WindowWithWebkitAudioContext extends Window {
  webkitAudioContext?: typeof AudioContext;
}

export const VoiceVisualization: React.FC<VoiceVisualizationProps> = ({
  isListening = false,
  isSpeaking = false,
  // isIdle = true,
  audioStream,
  size = 'md',
  variant = 'ripple',
  sensitivity = 5,
  aiIntensity = 0,
  conversationActive = false,
  recipientName = '',
}) => {
  // Only keep the state that's actually used
  const [pulseIntensity, setPulseIntensity] = useState(0);
  
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micDataArrayRef = useRef<Uint8Array | null>(null);
  const animationRef = useRef<number | null>(null);
  const aiAnimationRef = useRef<number | null>(null);

  const sizeConfig = {
    sm: { width: 80, height: 80, iconSize: 20 },
    md: { width: 120, height: 120, iconSize: 28 },
    lg: { width: 160, height: 160, iconSize: 36 },
    xl: { width: 192, height: 192, iconSize: 48 }
  };

  recipientName = recipientName || 'Teammate';

  const config = sizeConfig[size];

  // Enhanced AI animation based on speaking state and conversation activity
  useEffect(() => {
    if (isSpeaking && conversationActive) {
      const animateAI = () => {
        // Create realistic voice patterns
        const baseIntensity = aiIntensity || 50;
        const variation = Math.sin(Date.now() / 200) * 20; // Smooth wave
        const randomSpike = Math.random() > 0.7 ? Math.random() * 30 : 0; // Occasional spikes
        const breathingPattern = Math.sin(Date.now() / 1000) * 10; // Slower breathing pattern
        
        const newLevel = Math.max(20, Math.min(100, 
          baseIntensity + variation + randomSpike + breathingPattern
        ));
        
        // Directly set pulse intensity instead of storing in unused state
        setPulseIntensity(newLevel);
        
        aiAnimationRef.current = requestAnimationFrame(animateAI);
      };
      animateAI();
    } else {
      // Gradually fade out when not speaking
      const fadeOut = () => {
        setPulseIntensity(prev => {
          const newLevel = Math.max(0, prev - 2);
          if (newLevel > 0) {
            aiAnimationRef.current = requestAnimationFrame(fadeOut);
          }
          return newLevel;
        });
      };
      fadeOut();
    }

    return () => {
      if (aiAnimationRef.current) {
        cancelAnimationFrame(aiAnimationRef.current);
      }
    };
  }, [isSpeaking, conversationActive, aiIntensity]);

  // Microphone audio analysis for user input
  useEffect(() => {
    if (audioStream && isListening) {
      try {
        const windowWithWebkit = window as WindowWithWebkitAudioContext;
        const audioContext = new (window.AudioContext || windowWithWebkit.webkitAudioContext!)();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(audioStream);
        
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        
        micAnalyserRef.current = analyser;
        micDataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
        
        const analyzeMic = () => {
          if (!micAnalyserRef.current || !micDataArrayRef.current) return;
          
          micAnalyserRef.current.getByteFrequencyData(micDataArrayRef.current);
          const average = micDataArrayRef.current.reduce((sum, value) => sum + value, 0) / micDataArrayRef.current.length;
          const micLevel = Math.min(100, (average / 255) * 100 * sensitivity);
          
          // Directly set pulse intensity when listening
          if (isListening) {
            setPulseIntensity(micLevel);
          }
          
          animationRef.current = requestAnimationFrame(analyzeMic);
        };
        
        analyzeMic();
        
        return () => {
          audioContext.close();
        };
      } catch (error) {
        console.error('Microphone audio analysis error:', error);
        // Fallback: simulate microphone activity when listening
        if (isListening) {
          const simulateMic = () => {
            const simLevel = Math.random() * 30 + 10;
            setPulseIntensity(simLevel);
            animationRef.current = requestAnimationFrame(simulateMic);
          };
          simulateMic();
        }
      }
    } else {
      if (!isSpeaking) {
        setPulseIntensity(0);
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [audioStream, isListening, sensitivity, isSpeaking]);

  const getStateColor = (): string => {
    if (isSpeaking) return 'border-cerulean-500 bg-slate-100';
    if (isListening) return 'border-nonphotoblue-600 bg-slate-50';
    return 'border-slate-200 bg-slate-100';
  };

  const getStateIcon = (): React.ReactElement => {
    const iconProps = {
      width: config.iconSize,
      height: config.iconSize
    };

    if (isSpeaking) {
      return <SpeakerLoudIcon className="text-cerulean-600" {...iconProps} />;
    }
    if (isListening) {
      return <Mic className="text-nonphotoblue-600" {...iconProps} />;
    }
    return <BotMessageSquare className="text-gray-500" {...iconProps} />;
  };

  const renderPulseVariant = () => (
    <div className="relative flex items-center justify-center">
      {/* Main circle */}
      <div 
        className={`rounded-full border-4 flex items-center justify-center transition-all duration-200 relative z-10 ${getStateColor()}`}
        style={{ 
          width: config.width, 
          height: config.height,
          transform: `scale(${1 + (pulseIntensity / 800)})`,
          boxShadow: isSpeaking 
            ? `0 0 ${Math.max(15, pulseIntensity / 2)}px rgba(59, 130, 246, ${0.3 + pulseIntensity / 300})` 
            : isListening 
            ? `0 0 ${Math.max(10, pulseIntensity / 3)}px rgba(34, 197, 94, ${0.2 + pulseIntensity / 400})` 
            : 'none'
        }}
      >
        {getStateIcon()}
      </div>
      
      {/* Dynamic rings based on pulse intensity */}
      {(isSpeaking || isListening) && pulseIntensity > 5 && (
        <>
          <div 
            className={`absolute rounded-full border-2 animate-ping ${
              isSpeaking ? 'border-cerulean-300' : 'border-nonphotoblue-300'
            }`}
            style={{ 
              width: config.width + 40 + (pulseIntensity / 2), 
              height: config.height + 40 + (pulseIntensity / 2),
              animationDuration: `${Math.max(0.8, 2 - pulseIntensity / 60)}s`,
              opacity: Math.max(0.3, Math.min(0.8, pulseIntensity / 80))
            }}
          />
          {pulseIntensity > 30 && (
            <div 
              className={`absolute rounded-full border animate-ping ${
                isSpeaking ? 'border-cerulean-200' : 'border-nonphotoblue-200'
              }`}
              style={{ 
                width: config.width + 70 + (pulseIntensity / 1.5), 
                height: config.height + 70 + (pulseIntensity / 1.5),
                animationDuration: `${Math.max(1.2, 2.8 - pulseIntensity / 40)}s`,
                animationDelay: '0.2s',
                opacity: Math.max(0.2, Math.min(0.6, pulseIntensity / 120))
              }}
            />
          )}
          {pulseIntensity > 60 && (
            <div 
              className={`absolute rounded-full border animate-ping ${
                isSpeaking ? 'border-cerulean-100' : 'border-nonphotoblue-100'
              }`}
              style={{ 
                width: config.width + 100 + pulseIntensity, 
                height: config.height + 100 + pulseIntensity,
                animationDuration: `${Math.max(1.5, 3.5 - pulseIntensity / 30)}s`,
                animationDelay: '0.4s',
                opacity: Math.max(0.1, Math.min(0.4, pulseIntensity / 150))
              }}
            />
          )}
        </>
      )}
    </div>
  );

  const renderWaveformVariant = () => (
    <div className="relative flex items-center justify-center">
      {/* Main circle */}
      <div 
        className={`rounded-full border-4 flex items-center justify-center transition-all duration-200 relative z-10 ${getStateColor()}`}
        style={{ 
          width: config.width, 
          height: config.height,
          transform: `scale(${1 + (pulseIntensity / 1500)})`,
          boxShadow: isSpeaking 
            ? `0 0 ${Math.max(15, pulseIntensity / 2)}px rgba(59, 130, 246, 0.4)` 
            : isListening 
            ? `0 0 10px rgba(34, 197, 94, 0.3)` 
            : 'none'
        }}
      >
        {getStateIcon()}
      </div>
      
      {/* Rotating waveform rings */}
      {(isSpeaking || isListening) && pulseIntensity > 10 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <svg 
            width={config.width + 120} 
            height={config.height + 120} 
            className="animate-spin" 
            style={{ 
              animationDuration: `${Math.max(2, 6 - pulseIntensity / 20)}s`,
              opacity: Math.max(0.4, Math.min(0.9, pulseIntensity / 80))
            }}
          >
            <circle
              cx={(config.width + 120) / 2}
              cy={(config.height + 120) / 2}
              r={config.width / 2 + 30 + pulseIntensity / 4}
              fill="none"
              stroke={isSpeaking ? "rgb(59, 130, 246)" : "rgb(34, 197, 94)"}
              strokeWidth="3"
              strokeDasharray={`${8 + pulseIntensity / 15},${6 + pulseIntensity / 20}`}
              opacity="0.6"
            />
            <circle
              cx={(config.width + 120) / 2}
              cy={(config.height + 120) / 2}
              r={config.width / 2 + 45 + pulseIntensity / 3}
              fill="none"
              stroke={isSpeaking ? "rgb(59, 130, 246)" : "rgb(34, 197, 94)"}
              strokeWidth="2"
              strokeDasharray={`${4 + pulseIntensity / 25},${10 + pulseIntensity / 30}`}
              opacity="0.3"
              className="animate-spin"
              style={{ 
                animationDuration: `${Math.max(3, 8 - pulseIntensity / 15)}s`, 
                animationDirection: 'reverse' 
              }}
            />
          </svg>
        </div>
      )}
    </div>
  );

  const renderRippleVariant = () => (
    <div className="relative flex items-center justify-center">
      {/* Main circle */}
      <div 
        className={`rounded-full border-4 flex items-center justify-center transition-all duration-200 relative z-10 ${getStateColor()}`}
        style={{ 
          width: config.width, 
          height: config.height,
          transform: `scale(${1 + (pulseIntensity / 1200)})`,
          boxShadow: isSpeaking 
            ? `0 0 ${Math.max(15, pulseIntensity / 2)}px rgba(59, 130, 246, 0.4)` 
            : isListening 
            ? `0 0 10px rgba(34, 197, 94, 0.3)` 
            : 'none'
        }}
      >
        {getStateIcon()}
      </div>
      
      {/* Dynamic ripple effects */}
      {(isSpeaking || isListening) && pulseIntensity > 8 && (
        <div className="absolute inset-0 flex items-center justify-center">
          {[0, 1, 2, 3].map((index) => {
            const shouldShow = pulseIntensity > (index * 15 + 8);
            if (!shouldShow) return null;
            
            return (
              <div
                key={index}
                className={`absolute rounded-full border animate-ping ${
                  isSpeaking ? 'border-cerulean-400' : 'border-nonphotoblue-400'
                }`}
                style={{ 
                  width: config.width + (index + 1) * (25 + pulseIntensity / 6),
                  height: config.height + (index + 1) * (25 + pulseIntensity / 6),
                  animationDelay: `${index * 0.3}s`,
                  animationDuration: `${Math.max(1.2, 2.5 - pulseIntensity / 50)}s`,
                  opacity: Math.max(0.1, (0.7 - index * 0.15) * (pulseIntensity / 80))
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );

  const renderVariant = () => {
    switch (variant) {
      case 'waveform':
        return renderWaveformVariant();
      case 'ripple':
        return renderRippleVariant();
      default:
        return renderPulseVariant();
    }
  };

  return (
    <div className="flex flex-col items-center space-y-6">
      {renderVariant()}
      
      {/* Status text */}
      <div className="text-center">
        <p className={`text-lg font-medium transition-colors duration-300 ${
          isSpeaking ? 'text-cerulean-600' : 
          isListening ? 'text-nonphotoblue-600' : 
          'text-gray-500'
        }`}>
          {isSpeaking ? 'AI Speaking...' : 
           isListening ? 'Listening...' : 
           `Ready to discuss ${recipientName}?`}
        </p>
        
        <p className="text-sm text-gray-400 mt-1">
          {isSpeaking ? 'Say something to interrupt' : 
           isListening ? 'Share your thoughts' : 
           `This conversation will take about 3-4 minutes. The AI will ask you questions about your experience working with ${recipientName}.`}
        </p>

        {/* Debug info in development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-2 text-xs text-gray-500">
            {`Pulse: ${Math.round(pulseIntensity)}%`}
            {conversationActive && ' | 🎯 Event-Driven'}
          </div>
        )}
      </div>
    </div>
  );
};