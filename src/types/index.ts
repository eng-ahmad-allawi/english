export interface WordEntry {
  id: string;
  word: string;
  translation: string;
  category: string;
  createdAt: number;
  exampleSentence?: string;
  exampleTranslation?: string;
  explanation?: string;
}

export interface Category {
  name: string;
  icon: string;
}
