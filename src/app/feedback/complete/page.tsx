// src/app/feedback/complete/page.tsx
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';

export default function FeedbackCompletePage() {
  return (
    <div className="container mx-auto py-12 px-4 max-w-md">
      <Card>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>
          <CardTitle className="text-2xl">Feedback Completed</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-slate-600">
            Thank you for providing feedback. Your insights help your team grow and improve.
          </p>
          <p className="mt-4 text-slate-600">
            You&apos;ll receive another opportunity to provide feedback in the next cycle.
          </p>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button 
            onClick={() => window.close()}
            className="mt-2"
          >
            Close
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}