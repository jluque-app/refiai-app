export type ContentType = 'video' | 'article' | 'quiz' | 'simulator' | 'slide';

export interface QuizQuestion {
    id: string;
    text: string;
    type: 'multiple-choice' | 'short-answer' | 'number';
    options?: string[]; // For multiple-choice
    correctAnswer: string | number;
    tolerance?: number; // For 'number': accepted absolute deviation from correctAnswer
    unit?: string; // For 'number': hint shown next to the input (e.g. "€", "%")
    explanation?: string; // Feedback after answering
}

export interface LessonSection {
    type: 'markdown' | 'video' | 'image' | 'simulator' | 'quiz';
    content?: string; // Markdown text, Image URL, or Video URL
    simulatorId?: string; // For 'simulator' type
    alt?: string; // For 'image' type
    props?: Record<string, any>; // Extra config
    quizData?: QuizQuestion[]; // Interactive questions
}

export interface Lesson {
    id: string;
    title: string;
    type: ContentType; // Deprecated, infer from first section or keep for legacy
    description?: string;
    duration?: string;
    contentUrl?: string; // Deprecated
    simulatorId?: string; // Deprecated
    resources?: Resource[];
    sections?: LessonSection[]; // New Schema
    preview?: boolean; // If true, viewable for free even in a paid part (sample lesson)
}

export interface Unit {
    id: string;
    title: string;
    description?: string;
    lessons: Lesson[];
    quizId?: string; // Optional unit-level quiz
}

export interface CoursePart {
    id: string;
    title: string;
    description: string;
    price: number;
    priceId?: string;
    units: Unit[]; // Renamed from 'modules' to 'units' for clarity
}

export interface CourseData {
    title: string;
    description: string;
    parts: CoursePart[];
}

export interface Resource {
    title: string;
    type: 'pdf' | 'xlsx' | 'pptx' | 'doc';
    path: string;
}
