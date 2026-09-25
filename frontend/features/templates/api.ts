import { surveysApi } from '@/features/surveys/api';
import type { Paginated } from '@/shared/types';
import { surveyToTemplate, type Template } from './types';

/**
 * Templates are just surveys used as starting points.
 * We fetch published surveys (which are the most "reusable") and map them.
 */
export const templatesApi = {
  async list(params: { category?: string; search?: string } = {}): Promise<Template[]> {
    const r = await surveysApi.list({
      status: 'PUBLISHED',
      page_size: 100,
      ordering: '-updated_at',
    });
    let list = r.results.map(surveyToTemplate);

    if (params.category && params.category !== 'ALL') {
      list = list.filter((t) => t.category === params.category);
    }
    if (params.search) {
      const q = params.search.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q),
      );
    }
    return list;
  },

  /** Clone a survey and return the new one's id. */
  async useTemplate(surveyId: string): Promise<string> {
    const created = await surveysApi.duplicate(surveyId);
    return created.id;
  },
};