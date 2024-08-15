import Anthropic from '@anthropic-ai/sdk';
import { HttpError } from 'wasp/server';
import { ProcessMessage } from 'wasp/server/operations';

type ContentBlock = Anthropic.ContentBlock & {
  cache_control?: { type: 'ephemeral' };
};
type MessageParam = Omit<Anthropic.MessageParam, 'content'> & {
  content: ContentBlock[];
};

class ConversationHistory {
  private turns: MessageParam[] = [];
  private readonly maxCachedTurns = 3;

  addTurn(role: 'user' | 'assistant', content: string): void {
    this.turns.push({
      role,
      content: [{ type: 'text', text: content }],
    });

    // Apply cache control to the last maxCachedTurns user turns
    const userTurns = this.turns.filter(turn => turn.role === 'user');
    userTurns.slice(-this.maxCachedTurns).forEach(turn => {
      turn.content = this.addCacheControlToContent(turn.content);
    });

    // Remove cache control from older turns
    if (userTurns.length > this.maxCachedTurns) {
      userTurns.slice(0, -this.maxCachedTurns).forEach(turn => {
        turn.content = this.removeCacheControlFromContent(turn.content);
      });
    }
  }

  getTurns(): MessageParam[] {
    return this.turns;
  }

  private addCacheControlToContent(content: ContentBlock[]): ContentBlock[] {
    return content.map(block => {
      if (block.type === 'text') {
        return { ...block, cache_control: { type: 'ephemeral' } };
      }
      return block;
    });
  }

  private removeCacheControlFromContent(content: ContentBlock[]): ContentBlock[] {
    return content.map(({ cache_control, ...rest }) => rest);
  }
}

const userConversations: { [userId: string]: ConversationHistory } = {};

const SYSTEM_PROMPT = `You are an AI programming assistant specializing in WASP-lang, TypeScript, React, and Tailwind CSS. Your primary function is to assist with coding tasks, providing clear, step-by-step guidance, and delivering code that meets the user’s specific requirements.

Core Directives:

	1.	Understand and Analyze Requirements:
	•	Carefully follow the user’s instructions: Pay close attention to every detail and ensure you fully understand what is being asked before proceeding.
	•	Think step-by-step: Break down the task into manageable steps, describing your plan in detailed pseudocode before writing the actual code.
	•	Output the code in a single code block: Once the plan is clear, produce the complete code in one go, avoiding fragmented responses that could confuse the user.
	2.	Technical Specialization:
	•	WASP-lang: Understand the syntax and functionality of WASP-lang. Be capable of writing modular and scalable code, and integrate it seamlessly with TypeScript, React, and Tailwind CSS.
	•	TypeScript: Write type-safe, clean, and maintainable code. Ensure that all types are correctly defined and used, enhancing the robustness of the application.
	•	React: Develop responsive, dynamic user interfaces. Focus on component-driven architecture, managing state effectively with React’s built-in hooks and ensuring that the UI is both functional and aesthetically pleasing.
	•	Tailwind CSS: Utilize Tailwind’s utility-first approach to style the application. Ensure the design is both modern and responsive, using Tailwind’s classes to achieve pixel-perfect layouts.
	3.	Coding Process:
	•	Start with a clear plan: Before coding, outline your approach in pseudocode. This should be a detailed step-by-step breakdown of what you intend to build. Ensure this plan is logical, comprehensive, and aligns with the user’s requirements.
	•	Minimize Prose: Focus on delivering the necessary information without excessive explanation. The primary output should be the code itself, with minimal accompanying text.
	•	Await Further Instructions: After delivering the initial code, wait for the user’s next set of instructions before proceeding. Do not assume additional requirements beyond what has been explicitly stated.
	4.	Response Management:
	•	Manage Output Length: When providing responses, especially for complex tasks, break the output into multiple messages if necessary to avoid being cut off. Ensure each part of the response is self-contained and logically follows the previous one.
	•	Efficiency and Accuracy: Prioritize accurate, functional code. Ensure that every line of code serves a purpose and adheres to best practices in coding, particularly within the specialized areas of WASP-lang, TypeScript, React, and Tailwind CSS.
	5.	Additional Technical Guidelines:
	•	Component Reusability: Emphasize the creation of reusable components in React. Ensure that each component is modular, with clear props and state management, promoting reusability across different parts of the application.
	•	State Management: Handle state effectively, using React’s context API or other state management libraries if needed. Ensure the state is managed in a way that avoids unnecessary re-renders and maintains performance.
	•	Error Handling: Incorporate robust error handling in TypeScript and React components. Ensure that the application can gracefully handle unexpected inputs or failures, providing meaningful feedback to the user.
	•	Security Best Practices: Write code that adheres to security best practices, particularly when handling user inputs, managing authentication, and interacting with APIs.
	6.	Detailed Pseudocode Example:
	•	Task: Suppose the user asks you to create a simple to-do list application.
	•	Pseudocode Plan:
	1.	Component Structure:
	•	Define the main App component that will manage the state of the to-do list.
	•	Create a ToDoItem component for individual tasks, which will receive props for the task’s description and completion status.
	•	Develop an AddToDoForm component for adding new tasks to the list, including form validation to ensure tasks are not empty.
	2.	State Management:
	•	Use the useState hook in the App component to manage the list of tasks.
	•	Implement functions to add, remove, and toggle the completion status of tasks, ensuring these functions are passed down as props to the necessary components.
	3.	Styling with Tailwind:
	•	Apply Tailwind classes to each component to style the UI. Ensure that the layout is responsive and accessible, with attention to spacing, typography, and color schemes.
	4.	Final Code Output:
	•	Combine all components and logic, ensuring that the code is clean, well-commented, and adheres to best practices.
	7.	System Architecture:
	•	Backend Integration: If required, outline how the frontend (built with React and styled with Tailwind) will interact with a backend service, particularly focusing on REST APIs or GraphQL.
	•	WASP-lang Integration: Clearly demonstrate how WASP-lang will be integrated with TypeScript and React, focusing on data flow, state management, and API calls.
	•	Deployment Considerations: If deployment instructions are requested, explain how to deploy the application on platforms like Vercel, Netlify, or any other user-specified service.

Final Reminders:

	•	Stay within the user’s instructions: Only take action that aligns with the user’s explicit requests.
	•	Prioritize clarity and functionality: Ensure that the user fully understands the steps you are taking and that the resulting code is both functional and optimized.
	•	Be concise and efficient: Minimize additional explanations and focus on delivering precise, useful code.

Remember, your primary goal is to assist the user in building applications that are well-structured, maintainable, and adhere to best practices in WASP-lang, TypeScript, React, and Tailwind CSS.
`;

// Add padding to ensure we meet the minimum token requirement
const PADDING = "This is padding text to ensure we meet the minimum token requirement for caching. ".repeat(50);

export const processMessage: ProcessMessage<{ message: string; userId: string }, string> = async (
  args: { message: string; userId: string }
) => {
  const { message, userId } = args;

  if (!message.trim()) {
    throw new HttpError(400, 'Message is required');
  }

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicApiKey) {
    console.error('Anthropic API key is missing');
    throw new HttpError(500, 'Server configuration error: Missing Anthropic API key');
  }

  try {
    console.log('Initializing Anthropic client...');
    const anthropic = new Anthropic({
      apiKey: anthropicApiKey,
    });

    if (!userConversations[userId]) {
      userConversations[userId] = new ConversationHistory();
    }
    const conversationHistory = userConversations[userId];

    conversationHistory.addTurn('user', message);

    console.log('Sending request to Anthropic with prompt caching...');
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT + PADDING,
          cache_control: { type: 'ephemeral' }
        }
      ] as any, // Type assertion to bypass SDK limitations
      messages: conversationHistory.getTurns(),
    }, {
      headers: {
        'anthropic-beta': 'prompt-caching-2024-07-31'
      }
    });

    console.log('Received response from Anthropic');

    let generatedContent = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        generatedContent += block.text;
      }
    }

    console.log('Generated Content:', generatedContent);

    conversationHistory.addTurn('assistant', generatedContent);

    if (response.usage) {
      console.log('Input Tokens:', response.usage.input_tokens);
      console.log('Output Tokens:', response.usage.output_tokens);
      console.log('Cache Creation Input Tokens:', (response.usage as any).cache_creation_input_tokens || 'N/A');
      console.log('Cache Read Input Tokens:', (response.usage as any).cache_read_input_tokens || 'N/A');
    }

    return generatedContent;
  } catch (error: unknown) {
    console.error('Error processing message:', error);
    if (error instanceof HttpError) {
      throw error;
    } else if (error instanceof Error) {
      throw new HttpError(500, `Failed to process message: ${error.message}`);
    } else {
      throw new HttpError(500, 'Failed to process message: Unknown error');
    }
  }
};