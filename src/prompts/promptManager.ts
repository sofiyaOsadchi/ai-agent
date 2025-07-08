// src/prompts/promptManager.ts
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  variables?: string[];
}

export class PromptManager {
  private promptsPath: string;
  private templates: Map<string, PromptTemplate> = new Map();

  constructor(promptsPath: string = 'prompts') {
    this.promptsPath = promptsPath;
    this.loadPrompts();
  }

  // טעינת כל הפרומפטים מהתיקיה
  private loadPrompts(): void {
    try {
      const promptsDir = join(process.cwd(), this.promptsPath);
      
      if (!existsSync(promptsDir)) {
        console.log(chalk.yellow(`⚠️ Prompts directory not found: ${promptsDir}`));
        return;
      }

      // טעינת קבצי JSON
      const fs = require('fs');
      const files = fs.readdirSync(promptsDir).filter((file: string) => file.endsWith('.json'));
      
      files.forEach((file: string) => {
        try {
          const filePath = join(promptsDir, file);
          const content = readFileSync(filePath, 'utf8');
          const prompt: PromptTemplate = JSON.parse(content);
          
          this.templates.set(prompt.id, prompt);
          console.log(chalk.green(`✅ Loaded prompt: ${prompt.name}`));
        } catch (error) {
          console.log(chalk.red(`❌ Failed to load ${file}:`, error));
        }
      });

    } catch (error) {
      console.log(chalk.red('❌ Error loading prompts:', error));
    }
  }

  // קבלת פרומפט לפי ID
  getPrompt(id: string): PromptTemplate | undefined {
    return this.templates.get(id);
  }

  // קבלת רשימת כל הפרומפטים
  getAllPrompts(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }

  // יצירת פרומפט עם משתנים
  buildPrompt(id: string, variables: Record<string, string> = {}): string {
    const template = this.getPrompt(id);
    if (!template) {
      throw new Error(`Prompt template '${id}' not found`);
    }

    let prompt = template.template;
    
    // החלפת משתנים בפורמט {{variable}}
    Object.entries(variables).forEach(([key, value]) => {
      const pattern = new RegExp(`{{${key}}}`, 'g');
      prompt = prompt.replace(pattern, value);
    });

    return prompt;
  }

  // יצירת פרומפט עם הקשר קודם
  buildChainPrompt(id: string, previousContext: string, variables: Record<string, string> = {}): string {
    const basePrompt = this.buildPrompt(id, variables);
    
    if (previousContext.trim()) {
      return `Previous context: "${previousContext}"\n\nNew task: ${basePrompt}`;
    }
    
    return basePrompt;
  }

  // הוספת פרומפט חדש בזמן ריצה
  addPrompt(template: PromptTemplate): void {
    this.templates.set(template.id, template);
    console.log(chalk.green(`➕ Added prompt: ${template.name}`));
  }

  // הצגת כל הפרומפטים הזמינים
  listPrompts(): void {
    console.log(chalk.blue('\n📋 Available Prompts:'));
    this.templates.forEach(template => {
      console.log(chalk.white(`🔸 ${template.id}: ${template.name}`));
      console.log(chalk.gray(`   ${template.description}`));
      if (template.variables && template.variables.length > 0) {
        console.log(chalk.yellow(`   Variables: ${template.variables.join(', ')}`));
      }
    });
  }
}

// יצוא מחלקה בודדת (singleton)
export const promptManager = new PromptManager();