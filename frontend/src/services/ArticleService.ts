// src/services/ArticleService.ts
import { api } from 'boot/axios'; // Import configured Axios instance
import { Article, ArticleInput } from 'src/types/models';
import { host } from '../config/api';
import { useUtilizatorStore } from '../stores/useUtilizatorStores'

const API_ENDPOINT = host+'/articles';
const utilizatorStore = useUtilizatorStore()
const config = {
  headers: {
    Authorization: `Bearer ${utilizatorStore.utilizator?.access_token}`
  }
};
export const ArticleService = {
  async getArticles(): Promise<Article[]> {
    const response = await api.get<Article[]>(API_ENDPOINT);
    return response.data;
  },

  async getArticleById(id: number): Promise<Article> {
    const response = await api.get<Article>(`${API_ENDPOINT}/${id}`);
    return response.data;
  },

  async createArticle(articleData: ArticleInput): Promise<Article> {
    // Format content for Prisma's expected structure and add order field
    const payload = { 
      ...articleData, 
      content: articleData.content ? {
        create: articleData.content.map((item, index) => ({
          ...item,
          order: index // Add the order field based on the array index
        }))
      } : undefined 
    };
    const response = await api.post<Article>(API_ENDPOINT, payload, config);
    return response.data;
  },

  async updateArticle(id: number, articleData: ArticleInput): Promise<Article> {
    // Format content for Prisma's expected structure and add order field
    const payload = { 
      ...articleData, 
      content: articleData.content ? {
        create: articleData.content.map((item, index) => ({
          ...item,
          order: index // Add the order field based on the array index
        }))
      } : undefined 
    };
    const response = await api.patch<Article>(`${API_ENDPOINT}/${id}`, payload, config);
    return response.data;
  },

  async deleteArticle(id: number): Promise<void> {
    await api.delete(`${API_ENDPOINT}/${id}`, config);
  },
};