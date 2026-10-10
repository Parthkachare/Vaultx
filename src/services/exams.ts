import type { Paper } from '../data/mockData';

export interface PaperExamGroup {
  id: string;
  name: string;
  date: string;
  startTime: string;
  course: string;
  manager1: string;
  manager2: string;
  papers: Paper[];
}

export function groupPapersByExam(papers: Paper[]): PaperExamGroup[] {
  const groups = new Map<string, PaperExamGroup>();
  for (const paper of papers) {
    const id = [paper.examName, paper.examDate, paper.course].join('|');
    const group = groups.get(id);
    if (group) {
      group.papers.push(paper);
    } else {
      groups.set(id, {
        id,
        name: paper.examName,
        date: paper.examDate,
        startTime: paper.startTime,
        course: paper.course,
        manager1: paper.manager1,
        manager2: paper.manager2,
        papers: [paper],
      });
    }
  }
  return [...groups.values()].sort((left, right) => left.date.localeCompare(right.date) || left.name.localeCompare(right.name));
}

export function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}
