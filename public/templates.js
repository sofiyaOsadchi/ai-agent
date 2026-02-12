// public/templates.js

const TEMPLATES = {
    faq_hotel: {
        label: "🏨 Hotel FAQ",
        q: {
            system: "You are an expert SEO Researcher for hospitality.",
            user: "Generate 20 high-value FAQ questions for {{subject}}.\nFocus on: Check-in, Amenities, Policies, Location.\nReturn ONLY a Markdown Table (Category | Question | Priority).",
            sources: "Official Hotel Website\nBooking.com Profile\nTripAdvisor",
            tone: "Professional, inquisitive.",
            useWeb: true
        },
        a: {
            system: "You are a Senior Hotel Concierge.",
            user: "Provide answers for these questions.\nQUESTIONS:\n{{context}}\n\nFormat: TSV.",
            sources: "Official Website (Primary)",
            tone: "Welcoming, luxury hospitality tone.",
            useWeb: true
        },
        dup: "Check for duplicates in the data about {{subject}}.\nDATA:\n{{data}}",
        verify: "Verify facts for {{subject}}. Return 'OK' or 'WRONG'.\nDATA:\n{{data}}",
        grammar: "Check grammar. Return fixed answer or '-'.\nDATA:\n{{data}}"
    },

    faq_service: {
        label: "🚗 Car Rental / Service",
        q: {
            system: "You are a Car Rental Policy Expert. You focus on friction points.",
            // כאן המשתנה הקריטי: {{subject}}
            user: "Create a list of common questions for {{subject}}.\nFocus on: Pricing, Insurance, Mileage, License Requirements.\nReturn ONLY a Markdown Table.",
            sources: "Rental Terms & Conditions\nHelp Center",
            tone: "Clear, legal-aware, precise.",
            useWeb: true // חובה לרכבים כדי למצוא את התנאים
        },
        a: {
            system: "You are a Customer Support Agent.",
            user: "Answer these questions based on standard policies for {{subject}}.\nCONTEXT:\n{{context}}",
            sources: "Terms of Service",
            tone: "Direct, no fluff.",
            useWeb: true
        },
        // גם כאן אנחנו מעבירים את ה-subject
        dup: "Check for overlapping policy questions for {{subject}}.\nDATA:\n{{data}}",
        verify: "Verify policy details for {{subject}}.\nDATA:\n{{data}}",
        grammar: "Check for clarity and legal precision.\nDATA:\n{{data}}"
    },

    custom: { 
        label: "✨ Custom Template",
        q: { system: "", user: "", sources: "", tone: "" },
        a: { system: "", user: "", sources: "", tone: "" },
        dup: "", verify: "", grammar: "" 
    }
};

window.APP_TEMPLATES = TEMPLATES;