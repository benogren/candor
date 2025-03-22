// src/components/SidebarContent.tsx
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CircleHelp, BarChart2, Calendar, Clock, BookOpen } from 'lucide-react';


export function SidebarContent() {
  return (
    <div className="space-y-6">
        
        <section className='m-4 relative pb-8'>
            <div className='shadow-md rounded-lg bg-white p-4 text-slate-500 text-sm mb-2'>
                <p>
                    Ben is a strong leader who delegates effectively, communicates well, and provides excellent mentorship and support to his team. His responsiveness and reliability are rated highly (consistently 9-10/10), demonstrating his commitment to keeping projects and teams aligned.
                </p>
                <p>Strengths:</p>
                <ul className='list-disc list-inside'>
                    <li>Delegation & Leadership: Ben effectively distributes tasks, trusts his team, and provides necessary guidance.</li>
                    <li>Communication: He ensures transparency and clear direction, though there may be room to streamline updates.</li>
                    <li>Mentorship & Support: Rated 10/10, Ben is highly supportive and engaged in his team’s growth.</li>
                    <li>Responsiveness & Reliability: Consistently high ratings showcase his dependability.</li>
                </ul>

                <p>Strengths:</p>
                <ul className='list-disc list-inside'>
                    <li>Project Management & Prioritization: A low rating (2/10) suggests challenges in managing multiple projects. Improving prioritization, time management, and delegation could help.</li>
                    <li>Decision-Making: Strengthening data-driven analysis and empowering his team further may enhance strategic decision-making.</li>
                    <li>Employee Engagement: More direct engagement with employees at all levels could boost morale and provide valuable insights.</li>
                </ul>
                <p>
                Key Takeaway:<br/>
                Ben excels in leadership, communication, and mentorship but could benefit from improving his project management approach and increasing direct engagement with employees.
                </p>
            
            </div>
            <span className='text-xs text-gray-400 absolute right-0'>35 mins ago</span>
        </section>



      
    </div>
  );
}