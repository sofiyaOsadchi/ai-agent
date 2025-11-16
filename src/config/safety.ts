// src/config/safety.ts - מנהל בטיחות (80 שורות)
// =====================================================
// תפקיד: מונע שימוש יתר ב-API ועלויות לא מבוקרות
// =====================================================

import chalk from "chalk";

// ממשק להגדרת הגבלות בטיחות
export interface SafetyLimits {
  maxCalls: number;   // מקסימום קריאות API
  maxTokens: number;  // מקסימום טוקנים לקריאה
  maxTasks: number;   // מקסימום משימות בשרשרת
  delay: number;      // השהיה בין קריאות (ms)
}

// הגדרות מוכנות לסביבות שונות - 🔧 הגבלות מתוקנות
const MODES = {
  development: { maxCalls: 75, maxTokens: 2000, maxTasks: 5, delay: 1500 },
  default: { maxCalls: 20, maxTokens: 1500, maxTasks: 4, delay: 2000 },
  production: { maxCalls: 15, maxTokens: 1000, maxTasks: 3, delay: 3000 }
};

export class SafetyManager {
  private limits: SafetyLimits;
  private apiCalls = 0;
  private totalTokens = 0;

  constructor(mode: keyof typeof MODES = 'default') {
    this.limits = MODES[mode];
    console.log(chalk.blue(`🛡️ Safety mode: ${mode}`));
  }

  canMakeCall(): boolean {
    if (this.apiCalls >= this.limits.maxCalls) {
      console.log(chalk.red(`⛔ API limit reached (${this.limits.maxCalls})`));
      return false;
    }
    
    if (this.apiCalls >= this.limits.maxCalls * 0.8) {
      console.log(chalk.yellow(`⚠️ ${this.apiCalls}/${this.limits.maxCalls} calls used`));
    }
    
    return true;
  }

  canAddTask(currentCount: number): boolean {
    if (currentCount >= this.limits.maxTasks) {
      console.log(chalk.red(`⛔ Task limit reached (${this.limits.maxTasks})`));
      return false;
    }
    return true;
  }

  recordCall(tokens: number = 0): void {
    this.apiCalls++;
    this.totalTokens += tokens;
  }

  getLimits(): SafetyLimits {
    return { ...this.limits };
  }

  getStatus() {
    return {
      calls: this.apiCalls,
      maxCalls: this.limits.maxCalls,
      tokens: this.totalTokens,
      cost: this.apiCalls * 0.01,
      remaining: this.limits.maxCalls - this.apiCalls
    };
  }

  showStatus(): void {
    const s = this.getStatus();
    console.log(chalk.blue("\n📊 Status:"));
    console.log(chalk.white(`🔢 Calls: ${s.calls}/${s.maxCalls} (${s.remaining} left)`));
    console.log(chalk.white(`🎯 Tokens: ${s.tokens}`));
    console.log(chalk.white(`💰 Cost: ~$${s.cost.toFixed(3)}`));
    
    if (s.calls / s.maxCalls > 0.8) {
      console.log(chalk.red("🚨 High usage"));
    } else {
      console.log(chalk.green("✅ Normal usage"));
    }
  }

  showLimits(): void {
    console.log(chalk.blue("\n🛡️ Limits:"));
    console.log(chalk.white(`• Max calls: ${this.limits.maxCalls}`));
    console.log(chalk.white(`• Max tokens: ${this.limits.maxTokens}`));
    console.log(chalk.white(`• Max tasks: ${this.limits.maxTasks}`));
    console.log(chalk.white(`• Delay: ${this.limits.delay}ms`));
  }

  reset(): void {
    this.apiCalls = 0;
    this.totalTokens = 0;
    console.log(chalk.green("🔄 Counters reset"));
  }
}