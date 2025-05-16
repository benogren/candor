// src/db/seed.ts
import { db } from './index';
import { feedbackQuestions } from '../../drizzle/schema';

async function seedDatabase() {
  console.log('Seeding database...');
  
  try {
    console.log('Seeding feedback questions...');
    await db.insert(feedbackQuestions).values([
      {
        questionText: "Rate {name}'s contribution right now",
        questionType: "rating",
        scope: "global",
        active: true,
        questionDescription: "Over the past week, what was {name}'s level of contribution in meetings or to their work?",
        isAdminManageable: true
      },
      {
        questionText: "What should {name} keep doing?",
        questionType: "text",
        scope: "global",
        active: true,
        questionDescription: "In the past week, identify the areas where you think {name} is excelling and should continue to focus on.",
        isAdminManageable: true
      },
      {
        questionText: "My overall perception of {name} is...",
        questionType: "text",
        scope: "global",
        active: true,
        questionDescription: "How does {name} show up in meetings, calls, slack, email, or any other interactions you had with them this week?",
        isAdminManageable: true
      },
      {
        questionText: "What is one thing {name} should stop doing?",
        questionType: "text",
        scope: "global",
        active: true,
        questionDescription: "What are the areas that added friction, made things worse, or anything {name} should not do moving forward?",
        isAdminManageable: true
      },
      {
        questionText: "What is one thing {name} should start doing?",
        questionType: "text",
        scope: "global",
        active: true,
        questionDescription: "Suggest one new behavior, habit, or approach that could help {name} grow or be more effective in their role.",
        isAdminManageable: true
      },
      {
        questionText: "What are {name}'s key strengths?",
        questionType: "text",
        scope: "global",
        active: true,
        questionDescription: "What qualities or skills make {name} stand out? Consider both technical abilities and personal attributes that positively impact their work.",
        isAdminManageable: true
      },
      {
        questionText: "How well does {name} manage their time and workload?",
        questionType: "text",
        scope: "global",
        active: true,
        questionDescription: "Reflect on {name}'s ability to prioritize tasks, stay organized, and meet deadlines. Do they efficiently balance their responsibilities?",
        isAdminManageable: true
      },
      {
        questionText: "How well does {name} adapt to changing priorities?",
        questionType: "text",
        scope: "global",
        active: true,
        questionDescription: "When unexpected changes arise, how does {name} handle them? Are they flexible, proactive, and solution-oriented?",
        isAdminManageable: true
      },
      {
        questionText: "What three hard skills is {name} most successful with?",
        questionType: "text",
        scope: "global",
        active: true,
        questionDescription: "Identify the technical skills or expertise areas where {name} excels the most in their role.",
        isAdminManageable: true
      },
      {
        questionText: "How would you rate {name}'s ability to collaborate with others?",
        questionType: "rating",
        scope: "global",
        active: true,
        questionDescription: "Consider {name}'s teamwork skills. Do they contribute positively in group settings, listen to others, and work well cross-functionally?",
        isAdminManageable: true
      },
      {
        questionText: "How effectively does {name} communicate progress on team goals and projects?",
        questionType: "text",
        scope: "global",
        active: true,
        questionDescription: "Does {name} provide clear, timely updates on their work? How well do they ensure others are informed about project status and challenges?",
        isAdminManageable: true
      },
      {
        questionText: "What skills could help {name} become better at decision-making?",
        questionType: "text",
        scope: "global",
        active: true,
        questionDescription: "What areas of knowledge, experience, or critical thinking could {name} develop to improve their decision-making abilities?",
        isAdminManageable: true
      },
      {
        questionText: "Rate how well {name} manages multiple projects",
        questionType: "rating",
        scope: "global",
        active: true,
        questionDescription: "How effectively does {name} juggle multiple responsibilities? Do they stay organized and maintain quality across different projects?",
        isAdminManageable: true
      },
      {
        questionText: "What is an area you would like to see {name} improve?",
        questionType: "text",
        scope: "global",
        active: true,
        questionDescription: "Identify a specific skill, habit, or approach that could help {name} grow in their role or work more effectively.",
        isAdminManageable: true
      },
      {
        questionText: "Rate how often {name} meet deadlines",
        questionType: "rating",
        scope: "global",
        active: true,
        questionDescription: "Consider {name}'s consistency in completing work on time. Do they regularly deliver as expected, or do they struggle with deadlines?",
        isAdminManageable: true
      },
      {
        questionText: "How would you rate {name}s ability to communicate effectively?",
        questionType: "rating",
        scope: "global",
        active: true,
        questionDescription: "How well does {name} express their thoughts, listen to others, and ensure their messages are understood by different audiences?",
        isAdminManageable: true
      },
      {
        questionText: "Share an example of a company value {name} has brought to life",
        questionType: "text",
        scope: "global",
        active: true,
        questionDescription: "Think of a recent moment when {name} demonstrated one of the company's core values. How did they embody this value in their actions or decisions?",
        isAdminManageable: true
      },
      {
        questionText: "What are three or four words you would use to describe {name}?",
        questionType: "text",
        scope: "global",
        active: true,
        questionDescription: "Choose a few words that best capture {name}'s personality, work style, or impact on the team.",
        isAdminManageable: true
      },
      {
        questionText: "Rate {name}'s ability to mentor or support others",
        questionType: "rating",
        scope: "global",
        active: true,
        questionDescription: "How well does {name} help colleagues by sharing knowledge, coaching, or offering support?",
        isAdminManageable: true
      },
      {
        questionText: "Rate {name}'s leadership and influence, regardless of their title",
        questionType: "rating",
        scope: "global",
        active: true,
        questionDescription: "How well does {name} inspire, guide, or positively impact others?",
        isAdminManageable: true
      },
      {
        questionText: "Rate {name}'s problem-solving skills",
        questionType: "rating",
        scope: "global",
        active: true,
        questionDescription: "How effectively does {name} analyze challenges and find solutions?",
        isAdminManageable: true
      },
      {
        questionText: "Rate {name}'s responsiveness and reliability",
        questionType: "rating",
        scope: "global",
        active: true,
        questionDescription: "How dependable is {name} when it comes to responding to requests and following through?",
        isAdminManageable: true
      },
      {
        questionText: "Rate {name}'s leadership and influence, regardless of their title",
        questionType: "rating",
        scope: "global",
        active: true,
        questionDescription: "How well does {name} inspire, guide, or positively impact others?",
        isAdminManageable: true
      },
      {
        questionText: "Rate {name}'s ability to handle stress and pressure",
        questionType: "rating",
        scope: "global",
        active: true,
        questionDescription: "How well does {name} stay composed and effective in high-pressure situations?",
        isAdminManageable: true
      },
      {
        questionText: "Rate {name}'s ability to give and receive feedback",
        questionType: "rating",
        scope: "global",
        active: true,
        questionDescription: "How open and constructive is {name} when providing or receiving feedback?",
        isAdminManageable: true
      },
      {
        questionText: "Rate {name}'s accountability in their role",
        questionType: "rating",
        scope: "global",
        active: true,
        questionDescription: "How well does {name} take ownership of their responsibilities and commitments?",
        isAdminManageable: true
      },
      {
        questionText: "What is something {name} does exceptionally well?",
        questionType: "text",
        scope: "global",
        active: true,
        questionDescription: "Think about {name}'s strengths—what do they consistently excel at in their role? Consider their skills, work ethic, or contributions that stand out.",
        isAdminManageable: true
      },
      {
        questionText: "Is there anything that you would like to change about working with {name}?",
        questionType: "text",
        scope: "global",
        active: true,
        questionDescription: "Consider your working relationship with {name}. Are there any adjustments—big or small—that would improve collaboration, communication, or effectiveness?",
        isAdminManageable: true
      },
      {
        questionText: "What is an area or skill where {name} could improve?",
        questionType: "text",
        scope: "global",
        active: true,
        questionDescription: "Everyone has areas for growth. What is one specific skill or behavior {name} could focus on to improve their impact on the team or their work?",
        isAdminManageable: true
      },
      {
        questionText: "What does {name} uniquely bring to the team?",
        questionType: "text",
        scope: "global",
        active: true,
        questionDescription: "Reflect on what makes {name} valuable to the team. Is it their expertise, problem-solving ability, leadership, or something else that sets them apart?",
        isAdminManageable: true
      }
    ]);
    console.log('Feedback questions seeded successfully!');

    
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error; // Re-throw to be caught by the outer catch
  }
}

// Execute the function
seedDatabase()
  .then(() => {
    console.log('Database seeding completed successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Database seeding failed:', err);
    process.exit(1);
  });